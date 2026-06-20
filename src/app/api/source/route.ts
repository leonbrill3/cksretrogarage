import { NextRequest, NextResponse } from 'next/server';
import { getAgents } from '@/lib/store';
import { sendEmail } from '@/lib/email';

const HOUSE_INBOX = 'contact@cksretrogarage.com';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Clean, branded enquiry email (drops internal fields).
function buildEmail(
  data: Record<string, unknown>,
  opts: { car: string; agentName: string; isEnquiry: boolean },
) {
  const message = String(data.details || data.message || '').trim();
  const fields: [string, string, ('mailto' | 'tel' | '')?][] = [
    ['Customer', String(data.name || '').trim()],
    ['Email', String(data.email || '').trim(), 'mailto'],
    ['Phone', String(data.phone || '').trim(), 'tel'],
    ['Country', String(data.country || '').trim()],
    ['Budget', String(data.budget || '').trim()],
  ];
  const rows = fields.filter(([, v]) => v);

  const intro = opts.isEnquiry
    ? 'A buyer just enquired through your link.'
    : 'A new sourcing request just came in.';

  // Plain-text fallback
  const text = [
    `${opts.isEnquiry ? 'New enquiry' : 'New sourcing request'} — ${opts.car}`,
    '',
    intro,
    '',
    ...rows.map(([label, v]) => `${label}: ${v}`),
    ...(message ? ['', `Message: "${message}"`] : []),
    '',
    'Reply to this email to reach the customer directly.',
    '— CK Retro Garage · Connoisseur Acquisitions',
  ].join('\n');

  const rowsHtml = rows
    .map(([label, v, kind], i) => {
      const border = i === 0 ? '' : 'border-top:1px solid #262628;';
      const val =
        kind === 'mailto'
          ? `<a href="mailto:${esc(v)}" style="color:#c8a96a;text-decoration:none;">${esc(v)}</a>`
          : kind === 'tel'
            ? `<a href="tel:${esc(v).replace(/[^0-9+]/g, '')}" style="color:#c8a96a;text-decoration:none;">${esc(v)}</a>`
            : esc(v);
      return `<tr><td style="padding:9px 0;color:#7f7a70;width:96px;${border}">${esc(label)}</td><td style="padding:9px 0;${border}">${val}</td></tr>`;
    })
    .join('');

  const messageHtml = message
    ? `<div style="margin-top:22px;padding:16px 18px;background:#0f0f10;border-left:2px solid #c8a96a;color:#cfc9bd;font-size:14px;line-height:1.5;font-style:italic;">"${esc(message)}"</div>`
    : '';

  const html = `<div style="margin:0;padding:24px;background:#0d0d0e;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#161617;border:1px solid #2a2a2c;border-radius:4px;overflow:hidden;">
    <div style="padding:26px 30px;border-bottom:1px solid #2a2a2c;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ece6da;">CK Retro Garage</div>
      <div style="font-size:10px;letter-spacing:.3em;color:#c8a96a;text-transform:uppercase;margin-top:4px;">Connoisseur Acquisitions</div>
    </div>
    <div style="padding:30px;">
      <div style="font-size:11px;letter-spacing:.2em;color:#c8a96a;text-transform:uppercase;margin-bottom:10px;">${opts.isEnquiry ? 'New Enquiry' : 'New Sourcing Request'}</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:#ece6da;margin-bottom:8px;">${esc(opts.car)}</div>
      <div style="font-size:14px;color:#9a948a;margin-bottom:26px;">${esc(intro)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#ece6da;">${rowsHtml}</table>
      ${messageHtml}
      <div style="margin-top:26px;font-size:13px;color:#9a948a;line-height:1.5;">Just hit <strong style="color:#ece6da;">Reply</strong> to respond — it goes straight to the customer.</div>
    </div>
    <div style="padding:18px 30px;border-top:1px solid #2a2a2c;font-size:11px;color:#6f6a61;">CK Retro Garage · A private acquisition house · A copy of every enquiry is kept centrally.</div>
  </div>
</div>`;

  return { text, html };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, email, car, consent } = data ?? {};

    if (!name || !email || !car || !consent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // An attributed agent (from a co-branded listing) takes priority over
    // country-based routing; otherwise fall back to the territory router.
    const agents = await getAgents();
    const agent = data.agent ? agents.find((a) => a.id === data.agent) : undefined;
    const country = String(data.country || '').trim().toLowerCase();
    const territory = country
      ? agents.find((a) => (a.match || []).some((m) => country.includes(m)))
      : undefined;
    const to = agent?.email || territory?.email || HOUSE_INBOX;

    const { text, html } = buildEmail(data, {
      car: String(car),
      agentName: agent?.name || '',
      isEnquiry: !!agent,
    });

    // When routed to a specific agent, copy the house inbox so every lead is logged.
    const cc = agent && to !== HOUSE_INBOX ? [HOUSE_INBOX] : undefined;
    const subject = agent
      ? `New enquiry — ${car} (via ${agent.name})`
      : `New sourcing request — ${car}`;
    await sendEmail({ to, cc, replyTo: email, subject, html, text });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[source-lead] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
