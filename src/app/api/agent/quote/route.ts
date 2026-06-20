import { NextRequest, NextResponse } from 'next/server';
import { getCars, getAgents } from '@/lib/store';
import { signQuote, commissionFor } from '@/lib/quote';

export const runtime = 'nodejs';

const LOCALES = ['en', 'tr', 'es', 'de', 'nl'];

// Build links from the host the request actually came in on, so they work on
// the live domain (onrender now, custom domain later) — never a hardcoded host.
function baseUrl(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `https://${host}`;
  return req.nextUrl.origin;
}

// Mint a signed, co-branded quote link. Authenticated by the agent's secret
// token (the same one that gates their dashboard).
export async function POST(req: NextRequest) {
  let body: { token?: string; slug?: string; askingPrice?: number | string; locale?: string };
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
  if (!Number.isFinite(asking) || asking <= 0) {
    return NextResponse.json({ error: 'Enter a valid asking price.' }, { status: 400 });
  }
  if (asking < car.minPrice) {
    return NextResponse.json(
      { error: `Asking price can't be below your minimum (${car.currency || 'EUR'} ${car.minPrice.toLocaleString('en-US')}).` },
      { status: 400 },
    );
  }

  const locale = LOCALES.includes(body.locale || '') ? body.locale : 'en';
  const quoteToken = await signQuote({ c: car.slug, a: agent.id, p: asking });
  const url = `${baseUrl(req)}/${locale}/q/${quoteToken}`;

  return NextResponse.json({
    ok: true,
    url,
    asking,
    commission: commissionFor(asking, car.minPrice),
    currency: car.currency || 'EUR',
  });
}
