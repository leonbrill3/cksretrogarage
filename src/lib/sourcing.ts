// Where campaign finds come from. Two independent layers, merged:
//   A) Marketcheck  — structured US + Canada dealer/private/auction inventory
//                     (needs MARKETCHECK_API_KEY).
//   B) Claude web   — Anthropic's web-search tool finds auction/enthusiast
//                     listings (BaT, Cars & Bids, dealer sites) the aggregators
//                     miss. Uses ANTHROPIC_API_KEY, which is already set.
// Every source degrades gracefully: a missing key or an API error yields [],
// never a crash, so the feature works with whatever is configured.

import type { Campaign, Country, RunSlot } from '@/data/campaigns';

export type SourcedListing = {
  source: string;
  sourceUrl: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price?: number; // USD
  mileage?: number; // miles
  location?: string; // "City, ST"
  dealer?: string;
  photo?: string;
  title?: string;
};

export function sourcesConfigured(): { marketcheck: boolean; web: boolean; ebay: boolean } {
  return {
    marketcheck: !!process.env.MARKETCHECK_API_KEY,
    // Web discovery is validated now (every link is fetched & proven live before
    // it's shown), so it's on by default. Set DISABLE_WEB_SEARCH=1 to turn off.
    web: !!process.env.ANTHROPIC_API_KEY && process.env.DISABLE_WEB_SEARCH !== '1',
    ebay: !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
  };
}

export async function runSources(
  c: Campaign,
  slot: RunSlot = 'manual',
): Promise<{ listings: SourcedListing[]; sources: string[]; errors: string[]; okFamilies: Set<string> }> {
  const listings: SourcedListing[] = [];
  const sources: string[] = [];
  const errors: string[] = [];
  // Source families (marketcheck / ebay / web) that completed WITHOUT throwing
  // this run — even if they returned 0 rows. Used upstream so a transient API
  // failure (e.g. Marketcheck HTTP 429), OR a deliberately-skipped source, can't
  // be mistaken for "every listing is gone" and wipe the campaign's inventory.
  const okFamilies = new Set<string>();

  const jobs: Promise<void>[] = [];

  // Marketcheck bills per call against a tiny 500/month quota. With 6 campaigns
  // × 2 streams × up-to-2 countries, a daily morning scan is ~558/mo (over). So
  // query it every OTHER day (even UTC date) on the morning slot — ~270/mo —
  // plus always on a manual run. On the skipped runs 'marketcheck' isn't in
  // okFamilies, so those finds are kept (not marked gone). eBay/PCARMARKET still
  // run every slot, so live freshness is unaffected.
  const marketcheckToday =
    slot === 'manual' || (slot === 'morning' && new Date().getUTCDate() % 2 === 0);
  if (process.env.MARKETCHECK_API_KEY && marketcheckToday) {
    jobs.push(
      sourceMarketcheck(c)
        .then(({ rows, labels }) => {
          okFamilies.add('marketcheck');
          sources.push(...labels);
          listings.push(...rows);
        })
        .catch((e) => {
          errors.push(`marketcheck: ${String(e).slice(0, 200)}`);
        }),
    );
  }

  // Web-search source (Claude): broad discovery across auctions/enthusiast/
  // specialty-dealer channels. Every candidate is run through verifyListing()
  // before it's returned, so only proven-live detail pages (with photos) show
  // up — no broken links. Set DISABLE_WEB_SEARCH=1 to turn it off.
  if (process.env.ANTHROPIC_API_KEY && process.env.DISABLE_WEB_SEARCH !== '1') {
    jobs.push(
      sourceClaudeWeb(c)
        .then((rows) => {
          okFamilies.add('web');
          if (rows.length) sources.push('web');
          listings.push(...rows);
        })
        .catch((e) => {
          errors.push(`web: ${String(e).slice(0, 200)}`);
        }),
    );
  }

  if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) {
    jobs.push(
      sourceEbay(c)
        .then((rows) => {
          okFamilies.add('ebay');
          if (rows.length) sources.push('ebay');
          listings.push(...rows);
        })
        .catch((e) => {
          errors.push(`ebay: ${String(e).slice(0, 200)}`);
        }),
    );
  }

  // PCARMARKET live auctions — clean JSON API via the proxy, filtered to active
  // cars matching the campaign. Deterministic + live-by-construction.
  if (process.env.SCRAPER_API_KEY) {
    jobs.push(
      sourcePcarmarket(c)
        .then((rows) => {
          okFamilies.add('pcarmarket');
          if (rows.length) sources.push('pcarmarket');
          listings.push(...rows);
        })
        .catch((e) => {
          errors.push(`pcarmarket: ${String(e).slice(0, 200)}`);
        }),
    );
  }

  await Promise.all(jobs);
  return { listings, sources, errors, okFamilies };
}

// ---------- A) Marketcheck ----------
// Marketcheck exposes the same structured schema across several inventory
// streams. We pull the two we can trust to be CURRENTLY for sale:
//   • active  — franchise/independent DEALER stock (dealers pull sold cars;
//               vehicle_status is tracked, so it's reliable)
//   • fsbo    — PRIVATE-PARTY (for-sale-by-owner) listings   [US + CA]
// The `auction` stream is deliberately OMITTED: it has no reliable
// availability signal and is dominated by PAST-auction cars that houses keep
// published (e.g. a whole GAA batch all ~169 days on market, un-verifiable
// behind a bot wall) — it surfaced sold cars. Base host overridable via
// MARKETCHECK_BASE. Every row is still post-filtered by matchesCampaign().
const MC_STREAMS: { path: string; label: string; usOnly?: boolean; fresh?: boolean }[] = [
  { path: 'search/car/active', label: 'marketcheck' },
  { path: 'search/car/fsbo/active', label: 'marketcheck:private', fresh: true },
];

async function sourceMarketcheck(c: Campaign): Promise<{ rows: SourcedListing[]; labels: string[] }> {
  const key = process.env.MARKETCHECK_API_KEY!;
  const base = process.env.MARKETCHECK_BASE || 'https://mc-api.marketcheck.com/v2';
  const countries: Country[] = c.countries.length ? c.countries : ['US'];
  const out: SourcedListing[] = [];
  const labels = new Set<string>();

  for (const s of MC_STREAMS) {
    for (const country of countries) {
      if (s.usOnly && country !== 'US') continue;
      const rows = await marketcheckPage(base, key, s, c, country);
      if (rows.length) {
        labels.add(s.label);
        out.push(...rows);
      }
    }
  }
  // Marketcheck's vehicle_status LAGS the dealer's real sold-status (a car can be
  // marked SOLD on the dealer's own page while Marketcheck still lists it active
  // with vehicle_status=null). Proxy-fetch each VDP and drop it only if the page
  // POSITIVELY signals sold/out-of-stock — keep it on any uncertainty so we never
  // false-drop a live car.
  const verified = process.env.SCRAPER_API_KEY ? await dropSoldDealerListings(out) : out;
  return { rows: verified, labels: [...labels] };
}

// Fetch each dealer VDP (via proxy) and drop the ones the page says are sold.
async function dropSoldDealerListings(listings: SourcedListing[]): Promise<SourcedListing[]> {
  const kept: SourcedListing[] = [];
  const BATCH = 4; // respect the proxy's small concurrency budget
  for (let i = 0; i < listings.length; i += BATCH) {
    const checked = await Promise.all(
      listings.slice(i, i + BATCH).map(async (l) => {
        if (!l.sourceUrl) return l;
        const res = await proxiedFetch(l.sourceUrl);
        if (!res || !res.ok) return l; // can't verify → trust Marketcheck, keep
        const html = (await res.text()).slice(0, 120_000);
        return dealerPageSold(html) ? null : l;
      }),
    );
    kept.push(...checked.filter((l): l is SourcedListing => l !== null));
  }
  return kept;
}

// A dealer VDP positively says sold when its structured availability is
// out-of-stock. This is precise (unlike a bare "sold" substring, which also
// matches "Sold Inventory" nav and other cars): the OG product:availability and
// schema.org availability fields reflect THIS vehicle's real state.
function dealerPageSold(html: string): boolean {
  const m =
    html.match(/(?:product:availability|og:availability)["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/["']?availability["']?\s*:\s*["']([^"']+)["']/i);
  if (!m) return false;
  return /out\s*of\s*stock|sold\s*out|soldout|discontinued|unavailable/i.test(m[1]);
}

// Pull a full stream (paginating past the 50-row page cap) for one country.
// Previously we only ever fetched the first 50 rows of dealer-active, silently
// dropping the rest (e.g. 113 F430s existed but only 50 were seen).
async function marketcheckPage(
  base: string,
  key: string,
  stream: { path: string; label: string; fresh?: boolean },
  c: Campaign,
  country: Country,
): Promise<SourcedListing[]> {
  const PAGE = 50;
  // Marketcheck bills per API CALL against a tiny 500/month quota, so we take
  // just the first page (50 rows) per stream — one call. Covers the vast
  // majority of single-model searches; a rare high-count model is capped at 50
  // rather than burning multiple calls per scan.
  const CAP = 50;
  // Long-tail streams (fsbo/auction) can carry the odd stale row; only surface
  // ones Marketcheck has re-seen in the last 45 days.
  const minSeen = stream.fresh ? Math.floor(Date.now() / 1000) - 45 * 86400 : 0;
  const out: SourcedListing[] = [];

  for (let start = 0; start < CAP; start += PAGE) {
    const params = new URLSearchParams({ api_key: key, rows: String(PAGE), start: String(start) });
    if (stream.path === 'search/car/active') params.set('car_type', 'used');
    if (c.make) params.set('make', c.make);
    if (c.model) params.set('model', c.model);
    if (c.yearMin || c.yearMax)
      params.set('year_range', `${c.yearMin || 1980}-${c.yearMax || new Date().getFullYear() + 1}`);
    if (c.maxMileage) params.set('miles_range', `0-${c.maxMileage}`);
    if (c.priceMin || c.priceMax) params.set('price_range', `${c.priceMin || 0}-${c.priceMax || 100000000}`);
    params.set('country', country);

    let res = await fetch(`${base}/${stream.path}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    // Marketcheck rate-limits bursts with 429; back off once before giving up.
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await fetch(`${base}/${stream.path}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { num_found?: number; listings?: MarketcheckListing[] };
    const page = data.listings || [];
    for (const l of page) {
      if (minSeen && typeof l.last_seen_at === 'number' && l.last_seen_at < minSeen) continue;
      if (!marketcheckUsable(l, !!stream.fresh)) continue;
      out.push(mapMarketcheck(l, country, stream.label));
    }
    const total = data.num_found ?? 0;
    if (page.length < PAGE || start + PAGE >= total) break;
  }
  return out;
}

type MarketcheckListing = {
  id?: string;
  vin?: string;
  price?: number;
  miles?: number;
  vdp_url?: string;
  heading?: string;
  last_seen_at?: number;
  seller_type?: string;
  source?: string;
  dom?: number;
  dom_active?: number;
  vehicle_status?: string;
  build?: { year?: number; make?: string; model?: string; trim?: string };
  dealer?: { name?: string; city?: string; state?: string };
  media?: { photo_links?: string[] };
};

// Marketcheck's fsbo/auction feeds carry a lot of stale rows: dead pages that
// the source site keeps published (so Marketcheck keeps re-seeing them). Filter
// them out so we never surface a sold/unavailable car.
const MC_DEAD_STATUS = new Set(['unavailable', 'sold', 'not available', 'removed', 'inactive', 'expired', 'gone']);
// Low-quality aggregators that republish long-dead listings (every listedbuy
// Ferrari 360 came back status=Unavailable, 800–1400 days on market).
const MC_JUNK_SOURCES = new Set(['listedbuy.com']);

function marketcheckUsable(l: MarketcheckListing, fresh: boolean): boolean {
  const status = (l.vehicle_status || '').trim().toLowerCase();
  if (MC_DEAD_STATUS.has(status)) return false;
  if (MC_JUNK_SOURCES.has((l.source || '').toLowerCase())) return false;
  if (!l.vdp_url) return false;
  // Days actively on market — a genuinely-current fsbo/private or auction
  // listing shouldn't have been live for half a year. (Dealer stock legitimately
  // sits longer, so this only applies to the fresh streams.)
  if (fresh) {
    const daysOnMarket = l.dom_active ?? l.dom ?? 0;
    if (daysOnMarket > 180) return false;
  }
  return true;
}

function mapMarketcheck(l: MarketcheckListing, country: Country, source = 'marketcheck'): SourcedListing {
  const b = l.build || {};
  const loc = [l.dealer?.city, l.dealer?.state].filter(Boolean).join(', ');
  return {
    source,
    sourceUrl: l.vdp_url || '',
    vin: l.vin,
    year: b.year,
    make: b.make,
    model: b.model,
    trim: b.trim,
    price: typeof l.price === 'number' ? l.price : undefined,
    mileage: typeof l.miles === 'number' ? l.miles : undefined,
    location: loc || country,
    dealer: l.dealer?.name,
    photo: l.media?.photo_links?.[0],
    title: l.heading || [b.year, b.make, b.model, b.trim].filter(Boolean).join(' '),
  };
}

// ---------- B) Claude web search ----------
// Ask Claude to search the live web for matching for-sale listings and return
// them via a structured tool call. Catches the auction/enthusiast long tail.
async function sourceClaudeWeb(c: Campaign): Promise<SourcedListing[]> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_CAMPAIGN_MODEL || 'claude-sonnet-4-6';

  const where = c.countries.includes('CA')
    ? c.countries.includes('US')
      ? 'the United States or Canada'
      : 'Canada'
    : 'the United States';
  const yr =
    c.yearMin && c.yearMax ? `${c.yearMin}–${c.yearMax}` : c.yearMin ? `${c.yearMin} or newer` : c.yearMax ? `${c.yearMax} or older` : 'any year';
  const criteria = [
    `Make/model: ${c.make} ${c.model}`,
    `Years: ${yr}`,
    c.maxMileage ? `Max mileage: ${c.maxMileage.toLocaleString('en-US')} miles` : null,
    c.priceMin || c.priceMax ? `Price: $${(c.priceMin || 0).toLocaleString('en-US')}–$${(c.priceMax || 0).toLocaleString('en-US')}` : null,
    c.trimKeywords ? `Must match: ${c.trimKeywords}` : null,
    `Location: ${where}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are a car-sourcing researcher hunting the AUCTION and ENTHUSIAST long tail — the cars big aggregators miss. Find vehicles CURRENTLY for sale (live auctions or dealer inventory) that match this brief.\n\nBrief:\n${criteria}\n\nCRITICAL RULES:\n1. Run several TARGETED searches. PRIORITIZE sites where every car has its own dedicated listing/lot page: Bring a Trailer (bringatrailer.com/listing/…), Cars & Bids (carsandbids.com/auctions/…), PCARMARKET (pcarmarket.com/auction/…), Collecting Cars (collectingcars.com/for-sale/…), Hemmings listing/dealer pages, duPont Registry individual car pages (dupontregistry.com/car/…), Classic.com (classic.com/veh/…), and individual specialty/exotic DEALER inventory pages (their own VDPs). Use patterns like "site:bringatrailer.com ${c.make} ${c.model}", "site:carsandbids.com ${c.make} ${c.model}", "site:pcarmarket.com ${c.make} ${c.model}", plus a couple of "${c.make} ${c.model} for sale" searches aimed at specialty exotic dealers.\n2. Return ONLY exact URLs that point to a SINGLE specific car (one VIN / one lot / one stock number). A URL is INVALID if it is a search, results, category, /shopping/, /cars-for-sale/, /b/ (an eBay browse page), /results/, or a bare make/model landing page. If the only URL you have for a car is a category/search page, DO NOT include it — skip that car. Never guess, shorten, or construct a URL.\nDO NOT return eBay, Cars.com, Autotrader, CarGurus, TrueCar, CarMax, Carfax, or CarsForSale URLs — those big marketplaces are already covered by other data feeds. Spend your searches on the auction houses, enthusiast marketplaces, and individual specialty/exotic DEALER sites listed above, which those feeds miss.\n3. Only include cars whose listing is LIVE right now (not sold, ended, or expired).\n4. For each, capture the exact detail-page URL, price (USD number), mileage (miles number), year, trim, and location.\n\nWhen done searching, call record_listings ONCE with everything you found. If you find nothing that qualifies, call it with an empty array.`;

  const body = {
    model,
    max_tokens: 8192,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 10 },
      {
        name: 'record_listings',
        description: 'Record the active for-sale listings found.',
        input_schema: {
          type: 'object',
          properties: {
            listings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'Exact listing page URL' },
                  title: { type: 'string' },
                  year: { type: 'number' },
                  price: { type: 'number', description: 'USD, number only' },
                  mileage: { type: 'number', description: 'Miles, number only' },
                  trim: { type: 'string' },
                  location: { type: 'string' },
                  vin: { type: 'string' },
                  site: { type: 'string', description: 'Source site name' },
                },
                required: ['url'],
              },
            },
          },
          required: ['listings'],
        },
      },
    ],
    messages: [{ role: 'user', content: prompt }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: unknown }[];
    stop_reason?: string;
  };
  if (process.env.WEB_DIAG === '1') {
    const searches = (data.content || []).filter((b) => b.type === 'server_tool_use').length;
    console.log(`[web:diag] ${c.make} ${c.model}: anthropic stop=${data.stop_reason} searches=${searches}`);
  }
  const call = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'record_listings');
  const raw = (call?.input as { listings?: WebListing[] } | undefined)?.listings || [];

  const candidates = raw
    // Skip eBay: it's already covered by the dedicated eBay Browse API source
    // (and eBay 403s our server-side verification fetch anyway).
    .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url) && !/ebay\.com/i.test(l.url))
    .map((l) => ({
      source: l.site ? `web:${l.site}` : 'web',
      sourceUrl: l.url,
      vin: typeof l.vin === 'string' ? l.vin : undefined,
      year: typeof l.year === 'number' ? l.year : undefined,
      make: c.make,
      model: c.model,
      trim: typeof l.trim === 'string' ? l.trim : undefined,
      price: typeof l.price === 'number' ? l.price : undefined,
      mileage: typeof l.mileage === 'number' ? l.mileage : undefined,
      location: typeof l.location === 'string' ? l.location : undefined,
      title: typeof l.title === 'string' ? l.title : `${c.make} ${c.model}`,
    })) as SourcedListing[];

  // VALIDATION GATE: never surface a link we haven't proven resolves to a live,
  // single-vehicle detail page. This is what guarantees "no broken links" while
  // still allowing broad discovery across every channel.
  if (process.env.WEB_DIAG === '1') {
    console.log(`[web:diag] ${c.make} ${c.model}: model returned ${raw.length} raw, ${candidates.length} well-formed URLs`);
    for (const l of candidates) console.log(`[web:diag]   candidate ${l.sourceUrl}`);
  }
  const checked = await Promise.all(candidates.map((l) => verifyListing(l)));
  const kept = checked.filter((l): l is SourcedListing => l !== null);
  if (process.env.WEB_DIAG === '1') {
    console.log(`[web:diag] ${c.make} ${c.model}: ${kept.length}/${candidates.length} passed verification`);
  }
  return kept;
}

type WebListing = {
  url: string;
  title?: string;
  year?: number;
  price?: number;
  mileage?: number;
  trim?: string;
  location?: string;
  vin?: string;
  site?: string;
};

// ---------- Listing verifier (shared gate for the web source) ----------
// Reject junk URL shapes instantly, then actually fetch the page and confirm it
// is a live, single-car detail page (not a search/category/home page, not sold/
// expired). Also harvests the real photo (og:image) and price when present, so
// verified web finds get images too. Returns null if it can't be proven live.

// Known non-detail URL patterns per site. If a candidate matches, it's a
// search/category/model page — drop it without even fetching.
const JUNK_URL_PATTERNS: RegExp[] = [
  /ebay\.com\/(b|sch|shop)\//i, // eBay category/search/shop, not /itm/<id>
  /ebay\.com\/itm\/(?!\d{6,})/i, // eBay /itm/ without a numeric id
  /cargurus\.com\/Cars\/(t-|l-|lp\/)/i, // CarGurus model/trim/list pages
  /cars\.com\/shopping\//i, // Cars.com search, not /vehicledetail/
  /autotrader\.com\/cars-for-sale\//i, // Autotrader search results
  /carfax\.com\/Used-[^/]+_[a-z]\d+/i, // Carfax model landing (…_w723, …_z11749)
  /\/(search|inventory|listings|results|for-sale|shopping)\/?(\?|$)/i, // generic listing indexes
  /autotempest\.com\/(results|trends)\//i,
  /(facebook\.com\/marketplace\/category|craigslist\.org\/search)/i,
  /autolist\.com\/[a-z]+-[a-z0-9]+\/?(\?|$)/i, // Autolist model landing (/ferrari-f430), not a listing
  /autolist\.com\/(?![^/?]*\d)[^/?]+\/?(\?|$)/i, // any Autolist path with no id/digits = model/search page
  /(cars\.com|cargurus\.com|autotrader\.com|truecar\.com|carmax\.com)\/[a-z-]+\/?(\?|$)/i, // bare make/model landings
];

// Site-specific proof that a fetched page is a real detail page (usually a
// listing id / VIN segment in the URL). If present, we trust the URL shape.
const DETAIL_URL_HINTS: RegExp[] = [
  /ebay\.com\/itm\/\d{6,}/i,
  /cars\.com\/vehicledetail\//i,
  /edmunds\.com\/[a-z-]+\/[a-z0-9-]+\/\d{4}\/vin\//i,
  /bringatrailer\.com\/listing\//i,
  /carsandbids\.com\/auctions\//i,
  /collectingcars\.com\/for-sale\//i,
  /pcarmarket\.com\/auction\//i,
  /hemmings\.com\/(classifieds\/)?(dealer\/|listing\/)/i,
  /dupontregistry\.com\/(autos\/listing|car)\//i, // /autos/listing/ (old) and /car/<make>/<model>/<year>/<vin>/<id> (current)
  /classic\.com\/veh\//i, // Classic.com individual vehicle page
  /\/lots?\/[a-z0-9][a-z0-9-]*\d/i, // auction-house lot pages: RM Sotheby's, Mecum, Bonhams, Gooding, Broad Arrow (…/lots/r0038-… , …/lot/1234)
  /(\/vehicle|\/inventory|\/listing|\/vdp|\/detail|\/stock)[-/][a-z0-9-]*\d/i, // dealer VDPs with an id/stock number
];

function looksLikeDetailUrl(url: string): boolean {
  return DETAIL_URL_HINTS.some((re) => re.test(url));
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Fetch a page, routing through the ScraperAPI web-unblocker when SCRAPER_API_KEY
// is set. This is what makes verification RELIABLE: premium/auction sites (BaT,
// Cars & Bids, PCARMARKET, Classic.com, Hemmings) 403 our datacenter IP, so a
// direct fetch can never confirm a listing is live/sold. Through the proxy we
// load the real page from a residential IP, past Cloudflare, and can apply the
// sold/dead-signal checks. Falls back to a direct fetch when no key is set.
// `render` spends more credits but defeats hard-JS Cloudflare challenges.
async function proxiedFetch(url: string, render = false): Promise<Response | null> {
  const key = process.env.SCRAPER_API_KEY;
  const ctrl = new AbortController();
  // The proxy adds real latency (residential fetch + optional JS render).
  const timer = setTimeout(() => ctrl.abort(), key ? 60_000 : 8_000);
  try {
    const target = key
      ? `https://api.scraperapi.com/?api_key=${key}&url=${encodeURIComponent(url)}&country_code=us${render ? '&render=true' : ''}`
      : url;
    return await fetch(target, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyListing(l: SourcedListing): Promise<SourcedListing | null> {
  const url = l.sourceUrl;
  const proxied = !!process.env.SCRAPER_API_KEY;
  const diag = process.env.WEB_DIAG === '1';
  const drop = (reason: string): null => {
    if (diag) console.log(`[web:diag]   DROP (${reason}) ${url}`);
    return null;
  };
  if (!url || JUNK_URL_PATTERNS.some((re) => re.test(url))) return drop('junk-url');

  try {
    let res = await proxiedFetch(url);
    // Some sites still throw a Cloudflare interstitial on the cheap fetch; retry
    // once with JS rendering (costs more proxy credits) before giving up.
    if (proxied && res && res.ok) {
      const peek = await res.clone().text();
      if (/just a moment|cf-browser-verification|challenge-platform/i.test(peek.slice(0, 2000))) {
        res = (await proxiedFetch(url, true)) || res;
      }
    }

    if (!res) return drop('neterr');
    if (!res.ok) {
      // Can't load the page → can't prove it's a LIVE, still-for-sale listing.
      // (With the proxy on, a non-OK here means genuinely gone/blocked, not just
      // our datacenter IP being filtered.) Correctness beats coverage: drop.
      return drop(`fetch-${res.status}`);
    }

    // A redirect to a search/home page means the original listing is gone. Under
    // the proxy, res.url is the proxy endpoint, so fall back to the original URL.
    const finalUrl = proxied ? url : res.url || url;
    if (JUNK_URL_PATTERNS.some((re) => re.test(finalUrl))) return drop('junk-final-url');

    const html = (await res.text()).slice(0, 400_000);

    // Sold / expired / not-found signals → drop. Check only the VISIBLE text:
    // strip <script>/<style>/<template> first, because SPAs (e.g. duPont
    // Registry) embed a "page not found" 404-route template inside a JSON blob
    // in a <script>, which would otherwise false-positive a live listing.
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<template[\s\S]*?<\/template>/gi, ' ')
      .toLowerCase();
    const deadSignals = [
      'no longer available',
      'this listing has ended',
      'listing not found',
      'page not found',
      '404 error',
      'vehicle sold',
      'has been sold',
      'sold out',
      'auction ended',
      'no results found',
      // Auction-specific "this lot is over" signals (BaT / PCARMARKET / Cars &
      // Bids / auction houses keep sold lots live at the same URL).
      'this auction has ended',
      'bidding has ended',
      'sold for $',
      'winning bid',
      'final bid',
      'sale has ended',
      'lot sold',
    ];
    if (deadSignals.some((s) => visible.includes(s))) return drop('dead-signal');

    // Must look like a single-car detail page. Accept if the URL itself is a
    // known detail shape, OR the page exposes a single vehicle/product schema.
    // NOTE: a bare og:type of "website"/"article" is NOT accepted — model and
    // search landing pages carry those, and that's how the aggregator pages
    // (e.g. autolist.com/ferrari-f430) slipped through before.
    const isTrustedUrl = looksLikeDetailUrl(finalUrl);
    const hasDetailSchema =
      /"@type"\s*:\s*"(car|vehicle|product|individualproduct)"/i.test(html) ||
      /og:type"[^>]*content="product"/i.test(html);
    if (!isTrustedUrl && !hasDetailSchema) return drop('not-detail-page');

    // Harvest a real photo (og:image / twitter:image), matching the meta tag
    // regardless of attribute order (some sites put content= before property=).
    const photo = extractOgImage(html) || l.photo;
    const hasPhoto = !!photo && /^https?:\/\//.test(photo);
    // A photo is REQUIRED for schema-only pages (keeps aggregator/model pages
    // out). But a URL that already matches a TRUSTED detail shape (e.g. a
    // pcarmarket.com/auction/ lot) is proven — some such sites hide og:image,
    // so we accept it photo-less rather than lose a real long-tail listing.
    if (!hasPhoto && !isTrustedUrl) return drop('no-photo');

    // Harvest a price if we didn't get one, from schema/meta.
    let price = l.price;
    if (typeof price !== 'number') {
      const pm =
        html.match(/"price"\s*:\s*"?([0-9][0-9,]{3,})"?/i) ||
        html.match(/property=["']product:price:amount["'][^>]+content=["']([0-9.,]+)["']/i);
      if (pm) {
        const n = Number(pm[1].replace(/[^0-9.]/g, ''));
        if (Number.isFinite(n) && n > 1000) price = n;
      }
    }

    // Harvest mileage from the page so every result shows an odometer and the
    // max-mileage filter can apply. Try schema fields first, then visible text.
    let mileage = l.mileage;
    if (typeof mileage !== 'number') {
      mileage = extractMileage(html);
    }

    if (diag) console.log(`[web:diag]   KEEP ${finalUrl}`);
    return { ...l, sourceUrl: finalUrl, photo: hasPhoto ? photo : undefined, price, mileage };
  } catch (e) {
    return drop(`exception-${String(e).slice(0, 40)}`); // any failure → not proven → not shown
  }
}

// Pull the hero image URL from og:image / twitter:image, tolerating either
// attribute order (content=… property=… as well as property=… content=…).
function extractOgImage(html: string): string | undefined {
  const tags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of tags) {
    if (!/(property|name)=["'](og:image(?::url)?|twitter:image)["']/i.test(tag)) continue;
    const c = tag.match(/content=["']([^"']+)["']/i);
    if (c && /^https?:\/\//.test(c[1])) return c[1];
  }
  return undefined;
}

// Pull an odometer reading out of listing-page HTML. Handles schema fields
// (mileageFromOdometer) and common visible forms ("34,152 miles", "34k mi").
function extractMileage(html: string): number | undefined {
  const schema =
    html.match(/"mileagefromodometer"[^0-9]*([0-9][0-9,]{2,})/i) ||
    html.match(/"mileage"\s*:\s*"?([0-9][0-9,]{2,})"?/i) ||
    html.match(/"odometer"\s*:\s*"?([0-9][0-9,]{2,})"?/i);
  if (schema) {
    const n = Number(schema[1].replace(/[^0-9]/g, ''));
    if (Number.isFinite(n) && n >= 100 && n < 1_000_000) return n;
  }
  // Visible text: "34,152 miles", "34,152 mi", "12k miles".
  const text =
    html.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*(?:miles|mi\b)/i) ||
    html.match(/\b([0-9]{2,6})\s*(?:miles|mi)\b/i) ||
    html.match(/\b([0-9]{1,3})\s*k\s*(?:miles|mi)\b/i);
  if (text) {
    let n = Number(text[1].replace(/[^0-9]/g, ''));
    if (/k\s*(?:miles|mi)/i.test(text[0])) n *= 1000;
    // Ignore a 0/near-0 reading — placeholder, not a real odometer.
    if (Number.isFinite(n) && n >= 100 && n < 1_000_000) return n;
  }
  return undefined;
}

// ---------- C) eBay Browse API ----------
// Structured live eBay Motors listings. Needs an eBay developer app
// (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET) — free at developer.ebay.com.
let ebayTok: { token: string; exp: number } | null = null;

async function ebayAccessToken(): Promise<string> {
  const id = process.env.EBAY_CLIENT_ID!;
  const secret = process.env.EBAY_CLIENT_SECRET!;
  if (ebayTok && ebayTok.exp > Date.now() + 60_000) return ebayTok.token;
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });
  if (!res.ok) throw new Error(`ebay token HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  ebayTok = { token: data.access_token, exp: Date.now() + (data.expires_in || 7200) * 1000 };
  return ebayTok.token;
}

async function sourceEbay(c: Campaign): Promise<SourcedListing[]> {
  const token = await ebayAccessToken();
  const params = new URLSearchParams({ q: `${c.make} ${c.model}`.trim(), limit: '50', category_ids: '6001' });
  const filters: string[] = [];
  if (c.priceMin || c.priceMax) {
    filters.push(`price:[${c.priceMin || 0}..${c.priceMax || 100000000}]`);
    filters.push('priceCurrency:USD');
  }
  if (filters.length) params.set('filter', filters.join(','));
  // eBay Motors marketplace: US unless the campaign is Canada-only.
  const marketplace = c.countries.includes('CA') && !c.countries.includes('US') ? 'EBAY_CA' : 'EBAY_US';

  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ebay HTTP ${res.status}`);
  const data = (await res.json()) as { itemSummaries?: EbayItem[] };
  const rows = (data.itemSummaries || []).map((it) => mapEbay(it, c));

  // The search response has NO mileage — it lives in each item's localizedAspects
  // (getItem). Fetch mileage/year per item so the odometer shows on every result
  // and the max-mileage filter actually works. eBay throttles bursts, so run the
  // detail calls in small concurrent batches with a light retry (firing all ~50
  // at once silently drops most).
  const withIds = rows
    .map((r, i) => ({ r, id: (data.itemSummaries || [])[i]?.itemId }))
    .filter((x): x is { r: SourcedListing; id: string } => !!x.id);

  const BATCH = 6;
  for (let i = 0; i < withIds.length; i += BATCH) {
    const slice = withIds.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async ({ r, id }) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const asp = await ebayItemAspects(id, token, marketplace);
            if (asp.mileage != null || asp.year != null || asp.vin || asp.location) {
              if (asp.mileage != null && r.mileage == null) r.mileage = asp.mileage;
              if (asp.year != null && r.year == null) r.year = asp.year;
              if (asp.vin && !r.vin) r.vin = asp.vin;
              if (asp.location) r.location = asp.location; // city, state — better than "US"
              return;
            }
          } catch {
            /* retry once */
          }
          await new Promise((res) => setTimeout(res, 250));
        }
      }),
    );
  }
  return rows;
}

// Fetch an eBay item's Mileage / Year from localizedAspects (getItem).
async function ebayItemAspects(
  itemId: string,
  token: string,
  marketplace: string,
): Promise<{ mileage?: number; year?: number; vin?: string; location?: string }> {
  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
    { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace, Accept: 'application/json' } },
  );
  if (!res.ok) return {};
  const data = (await res.json()) as {
    localizedAspects?: { name?: string; value?: string }[];
    shortDescription?: string;
    description?: string;
    itemLocation?: { city?: string; stateOrProvince?: string; country?: string };
  };
  const out: { mileage?: number; year?: number; vin?: string; location?: string } = {};
  for (const a of data.localizedAspects || []) {
    const name = (a.name || '').toLowerCase();
    const raw = String(a.value || '');
    const num = Number(raw.replace(/[^0-9]/g, ''));
    // Structured Mileage aspect. Dealers sometimes set it to 0 (blank) and put
    // the real odometer in the description — handled below.
    if ((name.includes('mile') || name.includes('odometer')) && out.mileage == null && Number.isFinite(num) && num >= 100)
      out.mileage = num;
    if (name === 'year' && out.year == null && Number.isFinite(num) && num >= 1950 && num <= 2100) out.year = num;
    if (name.includes('vin') && !out.vin) {
      const v = normalizeVin(raw);
      if (v) out.vin = v;
    }
  }
  // Fallback: the Mileage aspect was blank/0 — read the odometer out of the
  // listing's own text (e.g. "10,641 miles on the odometer").
  if (out.mileage == null) {
    out.mileage = mileageFromText(`${data.shortDescription || ''}\n${data.description || ''}`);
  }
  // Full city/state location (search summary only gives a masked ZIP + country).
  const loc = data.itemLocation;
  const cityState = [loc?.city, loc?.stateOrProvince].filter(Boolean).join(', ');
  if (cityState) out.location = cityState;
  return out;
}

// A VIN is 17 alphanumeric chars; reject dealer placeholders like all-zeros.
function normalizeVin(raw: string): string | undefined {
  const v = raw.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return undefined;
  if (/^0+$/.test(v) || /^(.)\1{16}$/.test(v)) return undefined; // 000…0 / repeated char
  return v;
}

// Pull an odometer reading out of free listing text. Prefers odometer-context
// and comma-formatted figures so it never mistakes "24 miles per gallon" or an
// EPA rating for the car's mileage.
function mileageFromText(text: string): number | undefined {
  if (!text) return undefined;
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const patterns: RegExp[] = [
    /([0-9]{1,3}(?:,[0-9]{3})+)\s*miles?\s+on\s+the\s+odometer/i, // "10,641 miles on the odometer"
    /(?:showing|with|just|only|merely)\s+([0-9]{1,3}(?:,[0-9]{3})+)\s*miles?/i, // "showing 19,127 miles"
    /([0-9]{1,3}(?:,[0-9]{3})+)\s*miles?\b(?!\s*(?:per|\/)\s*gallon|\s*per\s*hour)/i, // any comma-formatted "10,641 miles"
  ];
  for (const re of patterns) {
    const m = plain.match(re);
    if (m) {
      const n = Number(m[1].replace(/[^0-9]/g, ''));
      if (Number.isFinite(n) && n >= 100 && n < 1_000_000) return n;
    }
  }
  return undefined;
}

type EbayItem = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  itemLocation?: { city?: string; stateOrProvince?: string; country?: string };
};

function mapEbay(it: EbayItem, c: Campaign): SourcedListing {
  const title = it.title || `${c.make} ${c.model}`;
  const yr = title.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  const miMatch = title.match(/([\d,]{3,})\s*(?:miles|mi)\b/i);
  const miFromTitle = miMatch ? Number(miMatch[1].replace(/,/g, '')) : undefined;
  const loc = [it.itemLocation?.city, it.itemLocation?.stateOrProvince].filter(Boolean).join(', ') || it.itemLocation?.country;
  return {
    source: 'ebay',
    sourceUrl: it.itemWebUrl || '',
    year: yr ? Number(yr[1]) : undefined,
    make: c.make,
    model: c.model,
    price: it.price?.value ? Number(it.price.value) : undefined,
    mileage: typeof miFromTitle === 'number' && miFromTitle >= 100 ? miFromTitle : undefined,
    location: loc,
    photo: it.image?.imageUrl,
    title,
  };
}

// ---------- E) PCARMARKET live auctions (via the unblocker proxy) ----------
// PCARMARKET (auction/marketplace for exotics) 403s our datacenter IP, but its
// live-auctions JSON API loads through the proxy. The API has no working
// make/model filter (search is ignored), so we pull the whole live set once per
// scan (small, cached across campaigns) and filter client-side to Active cars
// whose vehicle make+model match the campaign. status=Active ⇒ live by
// construction, so a sold/ended lot can never appear.
type PcmVehicle = { year?: number; make?: string; model?: string };
type PcmAuction = {
  slug?: string;
  title?: string;
  status?: string;
  end_date?: string | null;
  time_remaining?: number | null;
  current_bid?: number | null;
  high_bid?: number | null;
  mileage_body?: number | null;
  featured_image_large_url?: string;
  featured_image_url?: string;
  vehicle?: PcmVehicle | null;
  is_marketplace?: boolean;
  marketplace_listing_slug?: string | null;
  country?: string;
};

// Shared per-process cache so all campaigns in one scan reuse a single fetch of
// the live-auction list (it's the same set for everyone).
let pcmCache: { at: number; auctions: PcmAuction[] } | null = null;

async function pcmLiveAuctions(): Promise<PcmAuction[]> {
  if (pcmCache && Date.now() - pcmCache.at < 5 * 60_000) return pcmCache.auctions;
  const all: PcmAuction[] = [];
  let url: string | null = 'https://www.pcarmarket.com/api/auctions/?status=live';
  for (let page = 0; page < 6 && url; page++) {
    const res = await proxiedFetch(url);
    if (!res || !res.ok) break;
    const data = (await res.json()) as { next?: string | null; results?: PcmAuction[] };
    all.push(...(data.results || []));
    url = data.next ? data.next.replace(/^http:/, 'https:') : null;
  }
  pcmCache = { at: Date.now(), auctions: all };
  return all;
}

async function sourcePcarmarket(c: Campaign): Promise<SourcedListing[]> {
  if (!process.env.SCRAPER_API_KEY) return []; // needs the proxy to reach PCARMARKET
  if (!c.make || !c.model) return [];
  const makeKey = c.make.trim().toLowerCase();
  const modelKey = c.model.toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = Date.now();
  const auctions = await pcmLiveAuctions();
  return auctions
    .filter((a) => {
      if ((a.status || '').toLowerCase() !== 'active') return false;
      // PCARMARKET's status=live feed lingers on ENDED lots (this is what showed
      // "Listing Expired" cards — esp. marketplace listings). The reliable signal
      // is the clock, not the status field: drop anything already over. (The
      // expired banner itself is JS-rendered, so a page fetch can't see it.)
      if (typeof a.time_remaining === 'number' && a.time_remaining <= 0) return false;
      const end = a.end_date ? Date.parse(a.end_date) : NaN;
      if (Number.isFinite(end) && end < now) return false;
      const v = a.vehicle;
      if (!v || (v.make || '').toLowerCase() !== makeKey) return false;
      return (v.model || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(modelKey);
    })
    .map((a) => mapPcm(a, c));
}

function mapPcm(a: PcmAuction, c: Campaign): SourcedListing {
  const v = a.vehicle || {};
  const sourceUrl =
    a.is_marketplace && a.marketplace_listing_slug
      ? `https://www.pcarmarket.com/marketplace/${a.marketplace_listing_slug}/`
      : `https://www.pcarmarket.com/auction/${a.slug || ''}/`;
  const price = typeof a.high_bid === 'number' ? a.high_bid : typeof a.current_bid === 'number' ? a.current_bid : undefined;
  return {
    source: 'pcarmarket',
    sourceUrl,
    year: v.year,
    make: c.make,
    model: c.model,
    price,
    mileage: typeof a.mileage_body === 'number' && a.mileage_body >= 100 ? a.mileage_body : undefined,
    location: a.country && a.country !== 'US' ? a.country : undefined,
    photo: a.featured_image_large_url || a.featured_image_url,
    title: a.title || [v.year, c.make, c.model].filter(Boolean).join(' '),
  };
}
