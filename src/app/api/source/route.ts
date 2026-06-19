import { NextRequest, NextResponse } from 'next/server';
import { routeEmailFor } from '@/data/contacts';
import { getAgent } from '@/data/agents';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, email, car, consent } = data ?? {};

    if (!name || !email || !car || !consent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // An attributed agent (from a co-branded listing) takes priority over
    // country-based routing; otherwise fall back to the territory router.
    const agent = getAgent(data.agent);
    const to = agent?.email || routeEmailFor(data.country);
    const payload = {
      ...data,
      routedTo: to,
      routedAgent: agent?.name || '',
      receivedAt: new Date().toISOString(),
    };

    // Send via Resend if configured; otherwise log for local/dev.
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      // When routed to a specific agent, keep the house inbox copied so every
      // lead is centrally logged.
      const houseCopy = 'contact@cksretrogarage.com';
      const cc = agent && to !== houseCopy ? [houseCopy] : undefined;
      const subject = agent
        ? `New enquiry — ${car} (via ${agent.name})`
        : `New sourcing request — ${car}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CK Retro Garage <leads@cksretrogarage.com>',
          to: [to],
          ...(cc ? { cc } : {}),
          reply_to: email,
          subject,
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
