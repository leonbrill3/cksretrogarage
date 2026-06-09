// Lightweight signed-cookie session for the admin panel.
// Uses Web Crypto (HMAC-SHA256) so it runs in both middleware and route handlers.

export const ADMIN_COOKIE = 'cks_admin';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'insecure-dev-secret-change-me'
  );
}

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const sig = await hmac(`admin:${expiry}`);
  return `${expiry}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expiry = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiryNum = Number(expiry);
  if (!Number.isFinite(expiryNum) || expiryNum < Date.now()) return false;
  const expected = await hmac(`admin:${expiry}`);
  return safeEqual(sig, expected);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}
