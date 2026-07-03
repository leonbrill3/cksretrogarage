import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { getCampaigns, saveCampaigns, getCampaignFinds, saveCampaignFinds, getCampaignRuns, saveCampaignRuns } from '@/lib/store';
import type { Campaign, Country } from '@/data/campaigns';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

async function authed(req: NextRequest): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return true;
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

function toInt(v: unknown): number | undefined {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { record?: Partial<Campaign>; deleteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const list = await getCampaigns();

  // ----- Delete (also purges this campaign's finds + runs) -----
  if (body.deleteId) {
    await saveCampaigns(list.filter((c) => c.id !== body.deleteId));
    const finds = await getCampaignFinds();
    await saveCampaignFinds(finds.filter((f) => f.campaignId !== body.deleteId));
    const runs = await getCampaignRuns();
    await saveCampaignRuns(runs.filter((r) => r.campaignId !== body.deleteId));
    return NextResponse.json({ ok: true, deleted: body.deleteId });
  }

  const r = body.record || {};
  if (!String(r.make || '').trim() || !String(r.model || '').trim()) {
    return NextResponse.json({ error: 'Make and model are required.' }, { status: 400 });
  }

  const id = r.id || randomUUID().replace(/-/g, '');
  const prev = list.find((c) => c.id === id);
  const now = new Date().toISOString();
  const countries = (Array.isArray(r.countries) ? r.countries : ['US']).filter(
    (x): x is Country => x === 'US' || x === 'CA',
  );

  const record: Campaign = {
    id,
    name: String(r.name || '').trim() || `${r.make} ${r.model}`.trim(),
    make: String(r.make).trim(),
    model: String(r.model).trim(),
    trimKeywords: String(r.trimKeywords || '').trim() || undefined,
    yearMin: toInt(r.yearMin),
    yearMax: toInt(r.yearMax),
    maxMileage: toInt(r.maxMileage),
    priceMin: toInt(r.priceMin),
    priceMax: toInt(r.priceMax),
    countries: countries.length ? countries : ['US'],
    runMorning: r.runMorning !== false,
    runAfternoon: r.runAfternoon !== false,
    alertEmail: String(r.alertEmail || '').trim() || undefined,
    status: r.status === 'paused' ? 'paused' : 'active',
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    lastRunAt: prev?.lastRunAt,
  };

  const next = prev ? list.map((c) => (c.id === id ? record : c)) : [...list, record];
  try {
    await saveCampaigns(next);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed', detail: String(e) }, { status: 500 });
  }
}
