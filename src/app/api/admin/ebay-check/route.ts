import { NextRequest, NextResponse } from 'next/server';
import { sourcesConfigured } from '@/lib/sourcing';
import { getCampaigns } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Replicate sourceEbay()'s exact request for a given campaign so we can see
// what params it builds and how many rows eBay returns for THOSE params.
async function probeCampaign(id: string) {
  const c = (await getCampaigns()).find((x) => x.id === id);
  if (!c) return { error: 'campaign not found' };

  const basic = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`,
  ).toString('base64');
  const tr = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });
  const tj = (await tr.json()) as { access_token?: string };
  if (!tj.access_token) return { error: 'token failed' };

  const cc = c as unknown as {
    make?: string; model?: string; priceMin?: number; priceMax?: number; countries?: string[];
  };
  const params = new URLSearchParams({
    q: `${cc.make || ''} ${cc.model || ''}`.trim(),
    limit: '50',
    category_ids: '6001',
  });
  const filters: string[] = [];
  if (cc.priceMin || cc.priceMax) {
    filters.push(`price:[${cc.priceMin || 0}..${cc.priceMax || 100000000}]`);
    filters.push('priceCurrency:USD');
  }
  if (filters.length) params.set('filter', filters.join(','));
  const marketplace =
    (cc.countries || []).includes('CA') && !(cc.countries || []).includes('US') ? 'EBAY_CA' : 'EBAY_US';

  const sr = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${tj.access_token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace, Accept: 'application/json' },
  });
  const sj = (await sr.json()) as { total?: number; itemSummaries?: unknown[]; errors?: unknown };
  return {
    campaign: { name: (c as { name?: string }).name, make: cc.make, model: cc.model, priceMin: cc.priceMin, priceMax: cc.priceMax, countries: cc.countries },
    query: params.toString(),
    marketplace,
    searchStatus: sr.status,
    total: sj.total,
    count: (sj.itemSummaries || []).length,
    errors: sj.errors ?? null,
  };
}

// Temporary diagnostic: reports whether the running process actually sees the
// eBay credentials and can reach the Browse API. Safe to delete once eBay
// sourcing is confirmed working. Exposes only a short key prefix, never secrets.
export async function GET(req: NextRequest) {
  const hasId = !!process.env.EBAY_CLIENT_ID;
  const hasSecret = !!process.env.EBAY_CLIENT_SECRET;
  const cfg = sourcesConfigured();

  const campaignId = req.nextUrl.searchParams.get('id');
  if (campaignId && hasId && hasSecret) {
    return NextResponse.json({ campaignProbe: await probeCampaign(campaignId) });
  }

  let probe: unknown = 'not attempted (missing keys)';
  if (hasId && hasSecret) {
    try {
      const basic = Buffer.from(
        `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`,
      ).toString('base64');
      const tr = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
      });
      const tj = (await tr.json()) as { access_token?: string; error?: string; error_description?: string };
      if (!tj.access_token) {
        probe = { tokenStatus: tr.status, tokenBody: tj };
      } else {
        const sr = await fetch(
          'https://api.ebay.com/buy/browse/v1/item_summary/search?q=Ferrari%20F430&limit=3&category_ids=6001',
          {
            headers: {
              Authorization: `Bearer ${tj.access_token}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              Accept: 'application/json',
            },
          },
        );
        const sj = (await sr.json()) as { total?: number; itemSummaries?: unknown[]; errors?: unknown };
        probe = {
          tokenOk: true,
          searchStatus: sr.status,
          total: sj.total,
          count: (sj.itemSummaries || []).length,
          errors: sj.errors ?? null,
        };
      }
    } catch (e) {
      probe = { threw: String(e).slice(0, 300) };
    }
  }

  return NextResponse.json({
    cfg,
    hasId,
    hasSecret,
    idPrefix: (process.env.EBAY_CLIENT_ID || '').slice(0, 12),
    secretLen: (process.env.EBAY_CLIENT_SECRET || '').length,
    probe,
  });
}
