import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { getCampaigns } from '@/lib/store';
import { runCampaign } from '@/lib/campaign-runner';
import { sourcesConfigured } from '@/lib/sourcing';

export const runtime = 'nodejs';
export const maxDuration = 120; // web search + aggregator calls can be slow

// Manual "Run now" from the campaign editor. Runs a single campaign and
// returns the summary (no email — the admin is watching the screen).
export async function POST(req: NextRequest) {
  if (process.env.ADMIN_PASSWORD && !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = sourcesConfigured();
  if (!cfg.marketcheck && !cfg.web && !cfg.ebay) {
    return NextResponse.json(
      { error: 'No sourcing provider configured. Set ANTHROPIC_API_KEY (web search), MARKETCHECK_API_KEY, and/or EBAY_CLIENT_ID + EBAY_CLIENT_SECRET on Render.' },
      { status: 400 },
    );
  }

  let id = '';
  try {
    id = (await req.json())?.id || '';
  } catch {
    /* ignore */
  }
  const c = (await getCampaigns()).find((x) => x.id === id);
  if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  try {
    const { run } = await runCampaign(c, 'manual');
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    return NextResponse.json({ error: 'Run failed', detail: String(e).slice(0, 300) }, { status: 500 });
  }
}
