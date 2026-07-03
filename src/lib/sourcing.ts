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
    web: !!process.env.ANTHROPIC_API_KEY,
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

  if (process.env.ANTHROPIC_API_KEY) {
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

  const prompt = `You are a car-sourcing researcher. Search the live web for cars CURRENTLY FOR SALE that match this brief. Search broadly across marketplaces, auctions, and enthusiast sites — including eBay Motors, cars.com, Autotrader, CarGurus, Cars & Bids, Bring a Trailer, Classic.com, PCARMARKET, Hemmings, duPont Registry, AutoTempest, ClassicCars.com, exotic/specialist dealer sites, and marque forums (e.g. FerrariChat and other classic-car classifieds). Run several searches to maximize coverage. Only include listings that appear active (not sold/expired). For each, capture the exact listing URL, price (USD number), mileage (miles number), year, trim, and location.\n\nBrief:\n${criteria}\n\nWhen done searching, call record_listings ONCE with everything you found. If you find nothing active, call it with an empty array.`;

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

  return raw
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
    }));
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
  return (data.itemSummaries || []).map((it) => mapEbay(it, c));
}

type EbayItem = {
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
  const loc = [it.itemLocation?.city, it.itemLocation?.stateOrProvince].filter(Boolean).join(', ') || it.itemLocation?.country;
  return {
    source: 'ebay',
    sourceUrl: it.itemWebUrl || '',
    year: yr ? Number(yr[1]) : undefined,
    make: c.make,
    model: c.model,
    price: it.price?.value ? Number(it.price.value) : undefined,
    mileage: miMatch ? Number(miMatch[1].replace(/,/g, '')) : undefined,
    location: loc,
    photo: it.image?.imageUrl,
    title,
  };
}
