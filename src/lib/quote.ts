// Stateless, tamper-proof quote links (no database).
// A quote encodes {carSlug, agentId, askingPrice} and is HMAC-signed with the
// server secret, so a customer can't alter the price they were quoted.

const enc = new TextEncoder();

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'insecure-dev-secret-change-me'
  );
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}
function unb64url(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// c = car slug, a = agent id, p = asking price
export type QuotePayload = { c: string; a: string; p: number };

export async function signQuote(p: QuotePayload): Promise<string> {
  const body = b64url(JSON.stringify(p));
  const sig = await hmacHex(`quote:${body}`);
  return `${body}.${sig}`;
}

export async function verifyQuote(token: string | undefined): Promise<QuotePayload | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(`quote:${body}`);
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(unb64url(body)) as QuotePayload;
    if (typeof p.c === 'string' && typeof p.a === 'string' && typeof p.p === 'number') return p;
    return null;
  } catch {
    return null;
  }
}

// Agent keeps 70% of everything above the minimum; nothing at the floor.
export const COMMISSION_RATE = 0.7;

export function commissionFor(asking: number, minPrice: number): number {
  return Math.max(0, Math.round((asking - minPrice) * COMMISSION_RATE));
}
