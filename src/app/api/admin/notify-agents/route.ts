import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { getCars, getAgents } from '@/lib/store';
import { sendEmail, newCarEmail } from '@/lib/email';
import type { Car } from '@/data/cars';
import type { Agent } from '@/data/agents';

export const runtime = 'nodejs';

function baseUrl(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return host ? `https://${host}` : req.nextUrl.origin;
}

// Email every agent that a (sellable) car is available, each with their own
// dashboard link.
export async function POST(req: NextRequest) {
  if (
    process.env.ADMIN_PASSWORD &&
    !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let slug = '';
  try {
    ({ slug } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let cars: Car[];
  let agents: Agent[];
  try {
    [cars, agents] = await Promise.all([getCars(), getAgents()]);
  } catch (e) {
    return NextResponse.json({ error: 'Could not read data', detail: String(e) }, { status: 500 });
  }

  const car = cars.find((c) => c.slug === slug);
  if (!car || !car.sellable || typeof car.minPrice !== 'number') {
    return NextResponse.json({ error: 'Car is not sellable (set a minimum price first).' }, { status: 400 });
  }

  const recipients = agents.filter((a) => a.email && a.token);
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No agents to notify.' }, { status: 400 });
  }

  const base = baseUrl(req);
  let sent = 0;
  let skipped = 0;
  for (const agent of recipients) {
    const tpl = newCarEmail(car, `${base}/agent/${agent.token}`);
    const r = await sendEmail({ to: agent.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (r.ok) sent++;
    else skipped++;
  }

  // skipped (with sent 0) means RESEND_API_KEY isn't configured yet.
  return NextResponse.json({ ok: true, agents: recipients.length, sent, skipped });
}
