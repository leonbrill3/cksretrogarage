import { NextRequest, NextResponse } from 'next/server';
import { getCampaigns } from '@/lib/store';
import { runCampaign } from '@/lib/campaign-runner';
import { sendEmail, campaignDigestEmail } from '@/lib/email';
import type { RunSlot } from '@/data/campaigns';

export const runtime = 'nodejs';
export const maxDuration = 300; // may run several campaigns

// Twice-daily monitor. Trigger from a Render Cron Job or a scheduled GitHub
// Action, e.g.:
//   GET /api/cron/campaigns?slot=morning   with header  Authorization: Bearer <CRON_SECRET>
// Runs every active campaign whose cadence includes the given slot, then emails
// a digest per campaign that has new matches or price drops.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // must be configured
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const qp = req.nextUrl.searchParams.get('secret') || '';
  return bearer === secret || qp === secret;
}

async function processCampaigns(slot: RunSlot, origin: string) {
  const fallbackTo = process.env.CAMPAIGN_ALERT_EMAIL || process.env.ADMIN_EMAIL;

  const campaigns = (await getCampaigns()).filter((c) => {
    if (c.status !== 'active') return false;
    if (slot === 'morning') return c.runMorning;
    if (slot === 'afternoon') return c.runAfternoon;
    return true; // manual/unspecified slot → run all active
  });

  const results: { campaign: string; added: number; priceDrops: number; emailed: boolean; error?: string }[] = [];

  for (const c of campaigns) {
    try {
      const { newFinds, priceDrops } = await runCampaign(c, slot);
      let emailed = false;
      const to = c.alertEmail || fallbackTo;
      if (to && (newFinds.length || priceDrops.length)) {
        const adminUrl = `${origin}/admin/campaigns/${c.id}`;
        const { subject, html, text } = campaignDigestEmail(c, newFinds, priceDrops, adminUrl);
        const r = await sendEmail({ to, subject, html, text });
        emailed = r.ok;
      }
      results.push({ campaign: c.name, added: newFinds.length, priceDrops: priceDrops.length, emailed });
    } catch (e) {
      results.push({ campaign: c.name, added: 0, priceDrops: 0, emailed: false, error: String(e).slice(0, 200) });
    }
  }
  return results;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slotParam = (req.nextUrl.searchParams.get('slot') || '').toLowerCase();
  const slot: RunSlot = slotParam === 'afternoon' ? 'afternoon' : slotParam === 'morning' ? 'morning' : 'manual';
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  // The web-search layer + proxy verification make a full 5-campaign scan take
  // minutes — longer than the HTTP proxy will hold the connection (it 502s
  // ~100s). Since this runs on a persistent Render server (not serverless), kick
  // the scan off in the background and return immediately; results are written
  // to the DB (visible on /admin/campaigns/results) and digest emails go out as
  // each campaign finishes. Pass ?wait=1 to block for the results instead.
  if (req.nextUrl.searchParams.get('wait') === '1') {
    const results = await processCampaigns(slot, origin);
    return NextResponse.json({ ok: true, slot, ran: results.length, results });
  }

  void processCampaigns(slot, origin).catch(() => {
    /* background scan — errors are recorded per-run in the DB */
  });
  return NextResponse.json({ ok: true, slot, started: true }, { status: 202 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
