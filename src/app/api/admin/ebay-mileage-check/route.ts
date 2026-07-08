import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diagnostic: from the SERVER, search eBay for F430 then call getItem on each
// result and report whether mileage came back. Tells us if Render's IP is being
// throttled/blocked on the item endpoint (vs. our local machine). Delete after.
export async function GET() {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return NextResponse.json({ error: 'no eBay keys' }, { status: 500 });

  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const tr = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });
  const token = ((await tr.json()) as { access_token?: string }).access_token;
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 });

  const sr = await fetch(
    'https://api.ebay.com/buy/browse/v1/item_summary/search?q=Ferrari%20F430&limit=15&category_ids=6001',
    { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', Accept: 'application/json' } },
  );
  const items = ((await sr.json()) as { itemSummaries?: { itemId: string; title?: string }[] }).itemSummaries || [];

  const results: { title?: string; status: number; mileage: string | null }[] = [];
  for (const it of items) {
    const dr = await fetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(it.itemId)}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', Accept: 'application/json' },
    });
    let mileage: string | null = null;
    if (dr.ok) {
      const d = (await dr.json()) as { localizedAspects?: { name?: string; value?: string }[] };
      const mv = (d.localizedAspects || []).find((a) => (a.name || '').toLowerCase().includes('mile'));
      mileage = mv?.value ?? null;
    }
    results.push({ title: it.title?.slice(0, 40), status: dr.status, mileage });
  }

  const withMileage = results.filter((r) => r.mileage).length;
  const statusCounts = results.reduce<Record<number, number>>((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {});
  return NextResponse.json({ total: results.length, withMileage, statusCounts, results });
}
