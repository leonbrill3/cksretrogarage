import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { getCampaignFinds, saveCampaignFinds } from '@/lib/store';
import type { FindStatus } from '@/data/campaigns';

export const runtime = 'nodejs';

// Update a single find's status. Used by the results page to hide/unhide a
// listing (e.g. a car the dealer has actually sold). 'hidden' is sticky — the
// scanner never resurrects it (see campaign-runner).
const ALLOWED: FindStatus[] = ['active', 'hidden'];

export async function POST(req: NextRequest) {
  if (
    process.env.ADMIN_PASSWORD &&
    !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { id?: string; status?: FindStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'Provide id and status (active|hidden).' }, { status: 400 });
  }

  const finds = await getCampaignFinds();
  const f = finds.find((x) => x.id === id);
  if (!f) return NextResponse.json({ error: 'Find not found' }, { status: 404 });

  f.status = status;
  await saveCampaignFinds(finds);
  return NextResponse.json({ ok: true, id, status });
}
