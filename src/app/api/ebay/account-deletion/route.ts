import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eBay Marketplace Account Deletion / Closure notification endpoint.
// Required by eBay to enable a Production keyset.
//
//  - GET  ?challenge_code=... : eBay's endpoint-validation handshake. We must
//    respond with SHA-256(challengeCode + verificationToken + endpointUrl),
//    hex-encoded, as JSON { challengeResponse }.
//  - POST : an actual account-deletion notification. We store no eBay user
//    personal data (we only read public listing summaries via the Browse API),
//    so there is nothing to erase — we simply acknowledge with 200.
//
// Docs: https://developer.ebay.com/marketplace-account-deletion
//
// The endpoint URL registered in the eBay developer portal MUST exactly match
// EBAY_ENDPOINT_URL below (scheme + host + path, no trailing slash), and the
// verification token entered there must equal EBAY_VERIFICATION_TOKEN.

const DEFAULT_ENDPOINT = 'https://cksretrogarage.onrender.com/api/ebay/account-deletion';

function endpointUrl(): string {
  return process.env.EBAY_ENDPOINT_URL || DEFAULT_ENDPOINT;
}

export async function GET(req: NextRequest) {
  const token = process.env.EBAY_VERIFICATION_TOKEN;
  const challengeCode = req.nextUrl.searchParams.get('challenge_code');

  if (!token) {
    return NextResponse.json(
      { error: 'EBAY_VERIFICATION_TOKEN is not configured on the server.' },
      { status: 500 },
    );
  }
  if (!challengeCode) {
    return NextResponse.json({ error: 'Missing challenge_code.' }, { status: 400 });
  }

  // Order is significant: challengeCode, then verificationToken, then endpoint.
  const challengeResponse = createHash('sha256')
    .update(challengeCode)
    .update(token)
    .update(endpointUrl())
    .digest('hex');

  return NextResponse.json({ challengeResponse }, { status: 200 });
}

export async function POST(req: NextRequest) {
  // Acknowledge the notification. We keep no eBay user data, so nothing to delete.
  try {
    await req.json();
  } catch {
    /* body is optional for our purposes */
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
