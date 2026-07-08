// Sourcing campaigns — saved searches that hunt live inventory across the web
// for a specific car (e.g. "Ferrari 599 GTB manuals, US + Canada, under 40k mi")
// and monitor for new listings + price drops on a schedule.
// Stored in the DB under 'campaigns' / 'campaign_finds' / 'campaign_runs'.

export type Country = 'US' | 'CA';
export type CampaignStatus = 'active' | 'paused';

export type Campaign = {
  id: string;
  name: string; // e.g. "599 GTB gated manuals"
  make: string; // "Ferrari"
  model: string; // "599"
  trimKeywords?: string; // free text, e.g. "gated manual 6-speed"
  yearMin?: number;
  yearMax?: number;
  maxMileage?: number; // miles
  priceMin?: number; // USD
  priceMax?: number; // USD
  countries: Country[];
  // Which of the twice-daily runs this campaign participates in.
  runMorning: boolean;
  runAfternoon: boolean;
  alertEmail?: string; // where digests go (falls back to CAMPAIGN_ALERT_EMAIL / ADMIN_EMAIL)
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
};

// One unique vehicle surfaced by a campaign. Deduped by VIN when present,
// else by normalized source URL.
// 'hidden' is user-dismissed (e.g. sold on the dealer's site) — it stays out of
// the active list and is never resurrected by a scan (see campaign-runner).
export type FindStatus = 'active' | 'price_drop' | 'gone' | 'hidden';

export type CampaignFind = {
  id: string;
  campaignId: string;
  source: string; // 'marketcheck' | 'web' | site name
  sourceUrl: string; // the listing page
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
  title: string;
  status: FindStatus;
  priceHistory: { price: number; at: string }[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type RunSlot = 'morning' | 'afternoon' | 'manual';

export type CampaignRun = {
  id: string;
  campaignId: string;
  at: string;
  slot: RunSlot;
  found: number; // total listings sourced (after matching)
  added: number; // brand-new finds
  priceDrops: number;
  removed: number; // finds newly marked gone
  sources: string[]; // which sources contributed
  error?: string;
};

// ---- Helpers ----

// Dedupe key: VIN is authoritative; otherwise the normalized listing URL.
export function findKey(f: { vin?: string; sourceUrl: string }): string {
  const vin = (f.vin || '').trim().toUpperCase();
  if (vin.length >= 11) return `vin:${vin}`;
  return `url:${normalizeUrl(f.sourceUrl)}`;
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Drop query/hash + trailing slash so the same listing matches across runs.
    return `${u.host}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return (url || '').trim().toLowerCase();
  }
}

export function formatMiles(mi?: number): string {
  if (typeof mi !== 'number' || !Number.isFinite(mi)) return '—';
  return `${new Intl.NumberFormat('en-US').format(Math.round(mi))} mi`;
}

export function campaignSummary(c: Campaign): string {
  const yr =
    c.yearMin && c.yearMax
      ? `${c.yearMin}–${c.yearMax}`
      : c.yearMin
        ? `${c.yearMin}+`
        : c.yearMax
          ? `≤${c.yearMax}`
          : 'any year';
  const bits = [
    [c.make, c.model].filter(Boolean).join(' '),
    yr,
    c.maxMileage ? `≤${new Intl.NumberFormat('en-US').format(c.maxMileage)} mi` : null,
    c.countries.join('/') || '—',
  ].filter(Boolean);
  return bits.join(' · ');
}

// True if a sourced listing satisfies the campaign's hard filters. Applied
// after sourcing so correctness never depends on a provider honoring a param.
export function matchesCampaign(
  c: Campaign,
  l: { year?: number; mileage?: number; price?: number; model?: string; title?: string; trim?: string },
): boolean {
  if (c.yearMin && l.year && l.year < c.yearMin) return false;
  if (c.yearMax && l.year && l.year > c.yearMax) return false;
  // Max-mileage is strict: when a cap is set, a listing must have a KNOWN
  // mileage at or under it. Unknown mileage is excluded so high-/unknown-mileage
  // cars can't slip through (they previously passed because mileage was blank).
  if (c.maxMileage) {
    if (typeof l.mileage !== 'number') return false;
    if (l.mileage > c.maxMileage) return false;
  }
  if (c.priceMin && typeof l.price === 'number' && l.price < c.priceMin) return false;
  if (c.priceMax && typeof l.price === 'number' && l.price > c.priceMax) return false;
  // Model sanity check against the title/model when provided.
  if (c.model) {
    const hay = `${l.model || ''} ${l.title || ''} ${l.trim || ''}`.toLowerCase();
    if (hay && !hay.includes(c.model.toLowerCase())) return false;
  }
  return true;
}
