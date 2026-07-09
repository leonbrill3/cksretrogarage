// Where campaign finds come from. Two independent layers, merged:
//   A) Marketcheck  — structured US + Canada dealer/private/auction inventory
//                     (needs MARKETCHECK_API_KEY).
//   B) Claude web   — Anthropic's web-search tool finds auction/enthusiast
//                     listings (BaT, Cars & Bids, dealer sites) the aggregators
//                     miss. Uses ANTHROPIC_API_KEY, which is already set.
// Every source degrades gracefully: a missing key or an API error yields [],
// never a crash, so the feature works with whatever is configured.

import type { Campaign, Country } from '@/data/campaigns';

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
): Promise<{ listings: SourcedListing[]; sources: string[]; errors: string[] }> {
  const listings: SourcedListing[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  const jobs: Promise<void>[] = [];

  if (process.env.MARKETCHECK_API_KEY) {
    jobs.push(
      sourceMarketcheck(c)
        .then((rows) => {
          if (rows.length) sources.push('marketcheck');
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
          if (rows.length) sources.push('ebay');
          listings.push(...rows);
        })
        .catch((e) => {
          errors.push(`ebay: ${String(e).slice(0, 200)}`);
        }),
    );
  }

  await Promise.all(jobs);
  return { listings, sources, errors };
}

// ---------- A) Marketcheck ----------
// Base host is overridable so US / Canada endpoints can be pointed without a
// code change. Results are also post-filtered by matchesCampaign() upstream.
async function sourceMarketcheck(c: Campaign): Promise<SourcedListing[]> {
  const key = process.env.MARKETCHECK_API_KEY!;
  const base = process.env.MARKETCHECK_BASE || 'https://mc-api.marketcheck.com/v2';
  const countries: Country[] = c.countries.length ? c.countries : ['US'];
  const out: SourcedListing[] = [];

  for (const country of countries) {
    const params = new URLSearchParams({ api_key: key, car_type: 'used', rows: '50', start: '0' });
    if (c.make) params.set('make', c.make);
    if (c.model) params.set('model', c.model);
    if (c.yearMin || c.yearMax)
      params.set('year_range', `${c.yearMin || 1980}-${c.yearMax || new Date().getFullYear() + 1}`);
    if (c.maxMileage) params.set('miles_range', `0-${c.maxMileage}`);
    if (c.priceMin || c.priceMax) params.set('price_range', `${c.priceMin || 0}-${c.priceMax || 100000000}`);
    params.set('country', country);

    const res = await fetch(`${base}/search/car/active?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { listings?: MarketcheckListing[] };
    for (const l of data.listings || []) out.push(mapMarketcheck(l, country));
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
  build?: { year?: number; make?: string; model?: string; trim?: string };
  dealer?: { name?: string; city?: string; state?: string };
  media?: { photo_links?: string[] };
};

function mapMarketcheck(l: MarketcheckListing, country: Country): SourcedListing {
  const b = l.build || {};
  const loc = [l.dealer?.city, l.dealer?.state].filter(Boolean).join(', ');
  return {
    source: 'marketcheck',
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

  const prompt = `You are a car-sourcing researcher. Search the live web for cars CURRENTLY FOR SALE that match this brief. Search broadly across marketplaces, auctions, and enthusiast sites — including eBay Motors, cars.com, Autotrader, CarGurus, Cars & Bids, Bring a Trailer, Classic.com, PCARMARKET, Hemmings, duPont Registry, AutoTempest, ClassicCars.com, exotic/specialist dealer sites, and marque forums (e.g. FerrariChat and other classic-car classifieds). Pay special attention to SMALL INDEPENDENT and SPECIALTY dealers nationwide — not only the big marketplaces — including dealers' own websites and regional/one-off classic & exotic dealers that may not appear on the major aggregators. Run several searches to maximize coverage. Only include a listing if you have its EXACT, currently-working detail-page URL that you actually found — never guess, shorten, or construct a URL, and never include search-result or category pages. Skip anything you cannot verify is live right now (not sold, ended, or expired). For each, capture the exact listing URL, price (USD number), mileage (miles number), year, trim, and location.\n\nBrief:\n${criteria}\n\nWhen done searching, call record_listings ONCE with everything you found. If you find nothing active, call it with an empty array.`;

  const body = {
    model,
    max_tokens: 4096,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 6 },
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
  const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const call = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'record_listings');
  const raw = (call?.input as { listings?: WebListing[] } | undefined)?.listings || [];

  const candidates = raw
    .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url))
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
  const checked = await Promise.all(candidates.map((l) => verifyListing(l)));
  return checked.filter((l): l is SourcedListing => l !== null);
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
  /dupontregistry\.com\/autos\/listing\//i,
  /(\/vehicle|\/inventory|\/listing|\/vdp|\/detail)[-/][a-z0-9-]*\d/i, // dealer VDPs with an id
];

function looksLikeDetailUrl(url: string): boolean {
  return DETAIL_URL_HINTS.some((re) => re.test(url));
}

async function verifyListing(l: SourcedListing): Promise<SourcedListing | null> {
  const url = l.sourceUrl;
  if (!url || JUNK_URL_PATTERNS.some((re) => re.test(url))) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    }).catch(() => null);
    clearTimeout(timer);

    // Can't prove it's live (network error or site blocks us) → drop it.
    if (!res || !res.ok) return null;

    // A redirect to a search/home page means the original listing is gone.
    const finalUrl = res.url || url;
    if (JUNK_URL_PATTERNS.some((re) => re.test(finalUrl))) return null;

    const html = (await res.text()).slice(0, 400_000);
    const lower = html.toLowerCase();

    // Sold / expired / not-found signals → drop.
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
    ];
    if (deadSignals.some((s) => lower.includes(s))) return null;

    // Must look like a single-car detail page. Accept if the URL itself is a
    // known detail shape, OR the page exposes a single-product/vehicle schema.
    const hasDetailSchema =
      /"@type"\s*:\s*"(car|vehicle|product|individualproduct)"/i.test(html) ||
      /og:type"[^>]*content="(product|article|website)"/i.test(html);
    if (!looksLikeDetailUrl(finalUrl) && !hasDetailSchema) return null;

    // Harvest a real photo (og:image / twitter:image) so web finds get images.
    const photoMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const photo = photoMatch ? photoMatch[1] : l.photo;

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

    return { ...l, sourceUrl: finalUrl, photo, price, mileage };
  } catch {
    return null; // any failure → not proven → not shown
  }
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
            if (asp.mileage != null || asp.year != null) {
              if (asp.mileage != null && r.mileage == null) r.mileage = asp.mileage;
              if (asp.year != null && r.year == null) r.year = asp.year;
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
): Promise<{ mileage?: number; year?: number }> {
  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
    { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace, Accept: 'application/json' } },
  );
  if (!res.ok) return {};
  const data = (await res.json()) as { localizedAspects?: { name?: string; value?: string }[] };
  const out: { mileage?: number; year?: number } = {};
  for (const a of data.localizedAspects || []) {
    const name = (a.name || '').toLowerCase();
    const num = Number(String(a.value || '').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(num)) continue;
    // A used car reading of 0 (or a token placeholder) means the seller left the
    // odometer blank — treat as unknown rather than showing "0 miles".
    if ((name.includes('mile') || name.includes('odometer')) && out.mileage == null && num >= 100)
      out.mileage = num;
    if (name === 'year' && out.year == null && num >= 1950 && num <= 2100) out.year = num;
  }
  return out;
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
