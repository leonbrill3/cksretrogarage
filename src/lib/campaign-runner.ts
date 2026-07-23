// Executes one campaign: source live listings, match against the criteria,
// dedupe against what we've already seen (by VIN, else URL), and classify each
// as new / price-drop / still-listed / gone. Persists finds + a run record.

import { randomUUID } from 'node:crypto';
import {
  type Campaign,
  type CampaignFind,
  type CampaignRun,
  type RunSlot,
  findKey,
  matchesCampaign,
} from '@/data/campaigns';
import {
  getCampaignFinds,
  saveCampaignFinds,
  getCampaignRuns,
  saveCampaignRuns,
  getCampaigns,
  saveCampaigns,
} from '@/lib/store';
import { runSources, type SourcedListing } from '@/lib/sourcing';

export type RunResult = {
  run: CampaignRun;
  newFinds: CampaignFind[];
  priceDrops: CampaignFind[];
};

// Prefer the source with the cleanest structured data when the same car shows
// up more than once (lower number = kept).
function sourceRank(source: string): number {
  if (source.startsWith('marketcheck')) return 0; // active / private / auction
  if (source === 'ebay') return 1;
  if (source === 'bringatrailer') return 2;
  return 3; // web:*
}

// Collapse a find's source label to its provider family, matching the
// okFamilies set from runSources (marketcheck:private → marketcheck, web:BaT → web).
function sourceFamily(source: string): string {
  if (source.startsWith('marketcheck')) return 'marketcheck';
  if (source === 'ebay') return 'ebay';
  if (source === 'bringatrailer') return 'bringatrailer';
  return 'web';
}

// Collapse duplicates of the same physical car across sources. Two listings are
// "the same car" if they share a valid VIN, or (no VIN) the same year + exact
// mileage. Since a campaign hunts one specific model, identical year + odometer
// (to the mile) is a strong signature for one vehicle — even when sources label
// the model differently (e.g. Marketcheck "430" vs eBay "F430").
function dedupeAcrossSources(listings: SourcedListing[]): SourcedListing[] {
  const sigs = (l: SourcedListing): string[] => {
    const keys: string[] = [];
    if (l.vin) keys.push(`vin:${l.vin.toUpperCase()}`);
    if (l.year && typeof l.mileage === 'number') keys.push(`ym:${l.year}:${l.mileage}`);
    return keys;
  };
  const winnerBySig = new Map<string, SourcedListing>();
  const kept: SourcedListing[] = [];
  for (const l of [...listings].sort((a, b) => sourceRank(a.source) - sourceRank(b.source))) {
    const keys = sigs(l);
    if (keys.length && keys.some((k) => winnerBySig.has(k))) continue; // dup of a kept car
    kept.push(l);
    for (const k of keys) winnerBySig.set(k, l);
  }
  return kept;
}

export async function runCampaign(c: Campaign, slot: RunSlot): Promise<RunResult> {
  const now = new Date().toISOString();
  const runId = randomUUID().replace(/-/g, '');

  let sourced: SourcedListing[] = [];
  let sources: string[] = [];
  let okFamilies = new Set<string>();
  let errorMsg: string | undefined;
  try {
    const r = await runSources(c);
    sourced = r.listings;
    sources = r.sources;
    okFamilies = r.okFamilies;
    if (r.errors.length) errorMsg = r.errors.join(' | ');
  } catch (e) {
    errorMsg = String(e).slice(0, 300);
  }

  // Keep only listings that satisfy the hard filters and have a usable URL.
  const filtered = sourced.filter((l) => l.sourceUrl && matchesCampaign(c, l));
  // Collapse the SAME physical car surfaced by more than one source (e.g. a
  // dealer car on both Marketcheck and eBay), keeping the richest record.
  const matched = dedupeAcrossSources(filtered);

  // Load all finds; work on this campaign's slice, leave others untouched.
  const allFinds = await getCampaignFinds();
  const mine = allFinds.filter((f) => f.campaignId === c.id);
  const others = allFinds.filter((f) => f.campaignId !== c.id);
  const byKey = new Map(mine.map((f) => [findKey(f), f]));

  const seen = new Set<string>();
  const newFinds: CampaignFind[] = [];
  const priceDrops: CampaignFind[] = [];

  for (const l of matched) {
    const key = findKey(l);
    if (seen.has(key)) continue; // de-dupe within this run
    seen.add(key);

    const prev = byKey.get(key);
    if (!prev) {
      const f: CampaignFind = {
        id: randomUUID().replace(/-/g, ''),
        campaignId: c.id,
        source: l.source,
        sourceUrl: l.sourceUrl,
        vin: l.vin,
        year: l.year,
        make: l.make,
        model: l.model,
        trim: l.trim,
        price: l.price,
        mileage: l.mileage,
        location: l.location,
        dealer: l.dealer,
        photo: l.photo,
        title: l.title || [l.year, l.make, l.model].filter(Boolean).join(' ') || 'Listing',
        status: 'active',
        priceHistory: typeof l.price === 'number' ? [{ price: l.price, at: now }] : [],
        firstSeenAt: now,
        lastSeenAt: now,
      };
      byKey.set(key, f);
      newFinds.push(f);
    } else {
      if (prev.status === 'hidden') continue; // sticky: user dismissed it; never resurrect across runs
      prev.lastSeenAt = now;
      // Refresh volatile fields.
      if (l.photo && !prev.photo) prev.photo = l.photo;
      if (l.location) prev.location = l.location;
      if (l.mileage != null) prev.mileage = l.mileage;
      // Correct a previously-stored bad odometer (0 / placeholder) when the
      // fresh source has none, so "0 miles" doesn't linger.
      else if (typeof prev.mileage === 'number' && prev.mileage < 100) prev.mileage = undefined;
      if (typeof l.price === 'number') {
        const dropped = typeof prev.price === 'number' && l.price < prev.price;
        if (l.price !== prev.price) prev.priceHistory.push({ price: l.price, at: now });
        prev.price = l.price;
        if (dropped) {
          prev.status = 'price_drop';
          priceDrops.push(prev);
        } else if (prev.status === 'gone') {
          prev.status = 'active';
        }
      } else if (prev.status === 'gone') {
        prev.status = 'active';
      }
    }
  }

  // Anything we had before but didn't see this run → mark gone — BUT only if the
  // source family that produced it actually ran OK this time. If Marketcheck (or
  // eBay) errored/rate-limited, its listings are simply absent, not sold, so we
  // must not retire the whole inventory on a transient failure.
  let removed = 0;
  for (const f of mine) {
    if (!seen.has(findKey(f)) && f.status !== 'gone' && f.status !== 'hidden') {
      if (!okFamilies.has(sourceFamily(f.source))) continue; // source failed → leave as-is
      f.status = 'gone';
      f.lastSeenAt = f.lastSeenAt; // keep last-seen as-is
      removed++;
    }
  }

  const mergedMine = Array.from(byKey.values());
  await saveCampaignFinds([...others, ...mergedMine]);

  const run: CampaignRun = {
    id: runId,
    campaignId: c.id,
    at: now,
    slot,
    found: matched.length,
    added: newFinds.length,
    priceDrops: priceDrops.length,
    removed,
    sources,
    error: errorMsg,
  };
  const runs = await getCampaignRuns();
  runs.unshift(run);
  // Cap the run log so it can't grow unbounded.
  await saveCampaignRuns(runs.slice(0, 500));

  // Stamp lastRunAt on the campaign.
  try {
    const camps = await getCampaigns();
    const idx = camps.findIndex((x) => x.id === c.id);
    if (idx >= 0) {
      camps[idx] = { ...camps[idx], lastRunAt: now };
      await saveCampaigns(camps);
    }
  } catch {
    /* non-fatal */
  }

  return { run, newFinds, priceDrops };
}
