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

export async function runCampaign(c: Campaign, slot: RunSlot): Promise<RunResult> {
  const now = new Date().toISOString();
  const runId = randomUUID().replace(/-/g, '');

  let sourced: SourcedListing[] = [];
  let sources: string[] = [];
  let errorMsg: string | undefined;
  try {
    const r = await runSources(c);
    sourced = r.listings;
    sources = r.sources;
    if (r.errors.length) errorMsg = r.errors.join(' | ');
  } catch (e) {
    errorMsg = String(e).slice(0, 300);
  }

  // Keep only listings that satisfy the hard filters and have a usable URL.
  const matched = sourced.filter((l) => l.sourceUrl && matchesCampaign(c, l));

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
      prev.lastSeenAt = now;
      // Refresh volatile fields.
      if (l.photo && !prev.photo) prev.photo = l.photo;
      if (l.location) prev.location = l.location;
      if (l.mileage != null) prev.mileage = l.mileage;
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

  // Anything we had before but didn't see this run → mark gone.
  let removed = 0;
  for (const f of mine) {
    if (!seen.has(findKey(f)) && f.status !== 'gone') {
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
