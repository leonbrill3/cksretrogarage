import { NextRequest, NextResponse } from 'next/server';
import { getCars, getAgents } from '@/lib/store';
import { signQuote } from '@/lib/quote';
import { sendEmail, quoteEmail } from '@/lib/email';

export const runtime = 'nodejs';

const LOCALES = ['en', 'tr', 'es', 'de', 'nl'];

function baseUrl(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return host ? `https://${host}` : req.nextUrl.origin;
}

// Send a branded quote email to a client, on the agent's behalf.
export async function POST(req: NextRequest) {
  let body: { token?: string; slug?: string; askingPrice?: number | string; locale?: string; to?: string; message?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const [agents, cars] = await Promise.all([getAgents(), getCars()]);
  const agent = agents.find((a) => a.token && a.token === body.token);
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const car = cars.find((c) => c.slug === (body.slug || ''));
  if (!car || !car.sellable || typeof car.minPrice !== 'number') {
    return NextResponse.json({ error: 'Car is not sellable' }, { status: 400 });
  }

  const asking = Number(String(body.askingPrice ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(asking) || asking < car.minPrice) {
    return NextResponse.json({ error: `Asking price must be at least your minimum.` }, { status: 400 });
  }

  const to = String(body.to || '').trim();
  if (!/.+@.+\..+/.test(to)) {
    return NextResponse.json({ error: 'Enter a valid client email.' }, { status: 400 });
  }

  const locale = LOCALES.includes(body.locale || '') ? body.locale! : 'en';
  const base = baseUrl(req);
  const token = await signQuote({ c: car.slug, a: agent.id, p: asking });
  const url = `${base}/${locale}/q/${token}`;

  const tpl = quoteEmail({
    car,
    agent,
    asking,
    currency: car.currency || 'EUR',
    url,
    message: String(body.message || ''),
    signature: String(body.signature || ''),
    baseUrl: base,
  });

  const r = await sendEmail({
    to,
    replyTo: agent.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  if (!r.ok && !r.skipped) {
    return NextResponse.json({ error: 'Could not send the email.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: r.ok, skipped: r.skipped, to });
}
