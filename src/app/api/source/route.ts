import { NextRequest, NextResponse } from 'next/server';
import { routeEmailFor } from '@/data/contacts';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, email, car, consent } = data ?? {};

    if (!name || !email || !car || !consent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const to = routeEmailFor(data.country);
    const payload = { ...data, routedTo: to, receivedAt: new Date().toISOString() };

    // Send via Resend if configured; otherwise log for local/dev.
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CK Retro Garage <leads@cksretrogarage.com>',
          to: [to],
          reply_to: email,
          subject: `New sourcing request — ${car}`,
          text: Object.entries(payload)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n'),
        }),
      });
    } else {
      console.log('[source-lead]', JSON.stringify(payload, null, 2));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[source-lead] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
