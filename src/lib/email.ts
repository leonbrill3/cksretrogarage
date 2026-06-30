// Central email sender + branded templates. All app email goes through here.
// Uses Resend when RESEND_API_KEY is set; otherwise logs (so nothing is lost)
// and reports skipped:true.

import { formatMoney, specEntries, type Car } from '@/data/cars';
import type { Agent } from '@/data/agents';

const SPEC_LABELS: Record<string, string> = {
  mileage: 'Mileage',
  transmission: 'Transmission',
  engine: 'Engine',
  exterior: 'Exterior',
  interior: 'Interior',
};

// Sender is configurable so we can use a verified domain now (aivacations.com)
// and switch to leads@cksretrogarage.com once that domain is verified.
const FROM = process.env.RESEND_FROM || 'CK’s Retro Garage <onboarding@resend.dev>';

export type SendResult = { ok: boolean; skipped?: boolean; error?: string };

export async function sendEmail(opts: {
  to: string | string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not set — would send:', opts.subject, '->', to.join(', '));
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to,
        ...(opts.cc?.length ? { cc: opts.cc } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('[email] Resend error', res.status, detail.slice(0, 300));
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] send failed', e);
    return { ok: false, error: String(e) };
  }
}

export function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Branded dark shell around inner content.
function shell(inner: string): string {
  return `<div style="margin:0;padding:24px;background:#0d0d0e;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#161617;border:1px solid #2a2a2c;border-radius:4px;overflow:hidden;">
    <div style="padding:26px 30px;border-bottom:1px solid #2a2a2c;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ece6da;">CK’s Retro Garage</div>
      <div style="font-size:10px;letter-spacing:.3em;color:#c8a96a;text-transform:uppercase;margin-top:4px;">Connoisseur Acquisitions</div>
    </div>
    ${inner}
    <div style="padding:18px 30px;border-top:1px solid #2a2a2c;font-size:11px;color:#6f6a61;">CK’s Retro Garage · A private acquisition house</div>
  </div>
</div>`;
}

const btn = (href: string, label: string) =>
  `<div style="margin-top:24px;text-align:center;"><a href="${esc(href)}" style="display:inline-block;background:#7c2230;color:#f3ede1;text-decoration:none;font-size:12px;letter-spacing:.18em;text-transform:uppercase;padding:14px 28px;">${esc(label)}</a></div>`;

// ---- Welcome email (sent when an agent is created) ----
export function welcomeEmail(agent: Agent, dashboardUrl: string) {
  const subject = 'Welcome to CK’s Retro Garage — your agent account';
  const inner = `<div style="padding:30px;">
    <div style="font-size:11px;letter-spacing:.2em;color:#c8a96a;text-transform:uppercase;margin-bottom:10px;">Your agent account</div>
    <div style="font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#ece6da;margin-bottom:14px;">Welcome to CK’s Retro Garage, ${esc(agent.name)}.</div>
    <div style="font-size:14px;color:#9a948a;line-height:1.6;margin-bottom:24px;">You're now set up to represent CK’s Retro Garage and earn on every car you place. Here's how it works.</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#d8d2c6;line-height:1.5;">
      <tr><td style="padding:8px 12px 8px 0;color:#c8a96a;vertical-align:top;">1</td><td style="padding:8px 0;">You get access to the cars we have <strong style="color:#ece6da;">available to sell</strong>.</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#c8a96a;vertical-align:top;border-top:1px solid #242426;">2</td><td style="padding:8px 0;border-top:1px solid #242426;">Each car has a confidential <strong style="color:#ece6da;">minimum price</strong> — your floor. Your client never sees it.</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#c8a96a;vertical-align:top;border-top:1px solid #242426;">3</td><td style="padding:8px 0;border-top:1px solid #242426;">You choose the <strong style="color:#ece6da;">asking price</strong> you quote your client (at or above the minimum).</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#c8a96a;vertical-align:top;border-top:1px solid #242426;">4</td><td style="padding:8px 0;border-top:1px solid #242426;">You keep <strong style="color:#ece6da;">70% of everything above the minimum</strong>. At the minimum you earn nothing — the higher you sell, the more you make.</td></tr>
    </table>
    <div style="margin-top:20px;padding:16px 18px;background:#0f0f10;border-left:2px solid #c8a96a;color:#cfc9bd;font-size:13px;line-height:1.6;"><strong style="color:#ece6da;">Example:</strong> minimum $100,000. You sell at $120,000 → <strong style="color:#c8a96a;">you earn $14,000</strong>, CK keeps $106,000.</div>
    <div style="margin-top:26px;font-size:13px;color:#9a948a;line-height:1.6;">To activate your dashboard, click below to review and accept our <strong style="color:#ece6da;">Independent Sales Agent Agreement</strong> — it confirms you're an independent contractor (not an employee) and covers confidentiality and the commission terms above. The link is also your private login — keep it to yourself.</div>
    ${btn(dashboardUrl, 'Review agreement & activate →')}
    <div style="margin-top:24px;font-size:13px;color:#9a948a;line-height:1.6;">Once you're in, you'll be ready to quote. Whenever we add a new car, you'll get an email with the details.</div>
  </div>`;
  const text = `Welcome to CK’s Retro Garage, ${agent.name}.\n\nHow it works:\n1. You get access to cars we have available to sell.\n2. Each car has a confidential minimum price — your floor. Your client never sees it.\n3. You choose the asking price you quote (at or above the minimum).\n4. You keep 70% of everything above the minimum. At the minimum you earn nothing.\n\nExample: minimum $100,000, sell at $120,000 → you earn $14,000.\n\nTo activate your dashboard, review and accept our Independent Sales Agent Agreement (it confirms you're an independent contractor, and covers confidentiality and the commission terms). This link is also your private login — keep it to yourself:\n${dashboardUrl}\n\n— CK’s Retro Garage`;
  return { subject, html: shell(inner), text };
}

// ---- New-car-to-sell email (sent to each agent on "Notify agents") ----
export function newCarEmail(car: Car, dashboardUrl: string) {
  const title = `${car.year} ${car.make} ${car.model}`;
  const subject = `New car to sell — ${title}`;
  const min = typeof car.minPrice === 'number' ? formatMoney(car.minPrice, car.currency || 'EUR') : '—';
  const base = dashboardUrl.replace(/\/agent\/.*$/, '');
  const first = car.images[0] || '';
  const cover = first
    ? /^https?:\/\//.test(first)
      ? first
      : `${base}${first.startsWith('/') ? '' : `/cars/${car.slug}/`}${first}`
    : '';
  const inner = `${cover ? `<img src="${esc(cover)}" alt="${esc(title)}" style="display:block;width:100%;height:auto;" />` : ''}
  <div style="padding:30px;">
    <div style="font-size:11px;letter-spacing:.2em;color:#c8a96a;text-transform:uppercase;margin-bottom:10px;">New car to sell</div>
    <div style="font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#ece6da;margin-bottom:8px;">${esc(title)}</div>
    <div style="font-size:14px;color:#9a948a;margin-bottom:24px;">CK has a new car available for you to offer your clients.</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#ece6da;">
      <tr><td style="padding:9px 0;color:#7f7a70;width:130px;">Your minimum</td><td style="padding:9px 0;"><span style="font-family:Georgia,serif;font-size:18px;color:#c8a96a;">${esc(min)}</span> <span style="color:#6f6a61;font-size:12px;">private</span></td></tr>
      ${car.location ? `<tr><td style="padding:9px 0;color:#7f7a70;border-top:1px solid #262628;">Location</td><td style="padding:9px 0;border-top:1px solid #262628;">${esc(car.location)}</td></tr>` : ''}
    </table>
    <div style="margin-top:18px;padding:14px 16px;background:#0f0f10;border-left:2px solid #c8a96a;color:#cfc9bd;font-size:13px;line-height:1.5;">Quote your client <strong style="color:#ece6da;">above</strong> the minimum and keep <strong style="color:#ece6da;">70% of the difference</strong>. At the minimum you earn nothing.</div>
    ${btn(dashboardUrl, 'Open your dashboard to send quotes →')}
  </div>`;
  const text = `New car to sell — ${title}\n\nCK has a new car available for you to offer your clients.\n\nYour minimum (private): ${min}\n${car.location ? `Location: ${car.location}\n` : ''}\nQuote above the minimum and keep 70% of the difference.\n\nOpen your dashboard:\n${dashboardUrl}\n\n— CK’s Retro Garage`;
  return { subject, html: shell(inner), text };
}

// ---- Branded quote email an agent sends to a client ----
export function quoteEmail(opts: {
  car: Car;
  agent: Agent;
  asking: number;
  currency: string;
  url: string;
  message: string;
  baseUrl: string;
  signature?: string;
}) {
  const { car, agent, asking, currency, url, message, baseUrl } = opts;
  const title = `${car.year} ${car.make} ${car.model}`;
  const subject = `${title} — from ${agent.name}, CK’s Retro Garage`;
  const price = formatMoney(asking, currency);
  const first = car.images[0] || '';
  const cover = first
    ? /^https?:\/\//.test(first)
      ? first
      : `${baseUrl}${first.startsWith('/') ? '' : `/cars/${car.slug}/`}${first}`
    : '';
  const specs = specEntries(car.specs).slice(0, 4);
  const phone = (agent.phone || '').trim();
  const signature =
    opts.signature && opts.signature.trim()
      ? opts.signature.trim()
      : `${agent.name}\nCK’s Retro Garage\n${agent.email}${phone ? ` · ${phone}` : ''}`;

  const specsHtml = specs.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#ece6da;margin-top:8px;">${specs
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:7px 0;color:#7f7a70;width:120px;${i ? 'border-top:1px solid #262628;' : ''}">${esc(SPEC_LABELS[k] || k)}</td><td style="padding:7px 0;${i ? 'border-top:1px solid #262628;' : ''}">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  const messageHtml = message.trim()
    ? `<div style="margin:0 0 22px;font-size:14px;color:#cfc9bd;line-height:1.6;white-space:pre-wrap;">${esc(message.trim())}</div>`
    : '';

  const inner = `${cover ? `<img src="${esc(cover)}" alt="${esc(title)}" style="display:block;width:100%;height:auto;" />` : ''}
  <div style="padding:30px;">
    ${messageHtml}
    <div style="font-size:11px;letter-spacing:.2em;color:#c8a96a;text-transform:uppercase;margin-bottom:10px;">A car selected for you</div>
    <div style="font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#ece6da;margin-bottom:6px;">${esc(title)}</div>
    <div style="font-family:Georgia,serif;font-size:22px;color:#c8a96a;margin-bottom:6px;">${esc(price)}</div>
    ${car.location ? `<div style="font-size:13px;color:#9a948a;">${esc(car.location)}</div>` : ''}
    ${specsHtml}
    ${btn(url, 'View full details & photos →')}
    <div style="margin-top:28px;border-top:1px solid #2a2a2c;padding-top:18px;font-size:13px;color:#9a948a;line-height:1.6;white-space:pre-wrap;">${esc(signature)}</div>
  </div>`;

  const text = `${message.trim() ? message.trim() + '\n\n' : ''}${title}\n${price}${car.location ? `\n${car.location}` : ''}\n\nView full details & photos:\n${url}\n\n${signature}`;
  return { subject, html: shell(inner), text };
}
