import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { getInventory, saveInventory, putMedia } from '@/lib/store';
import type { InventoryRecord, FileRef, CostItem } from '@/data/inventory';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

// A new upload arrives as a FileRef whose url is a data: URL. Persist it to the
// media table and swap in the served /api/media/<id> url. Existing refs pass
// through unchanged; null/empty clears the file.
async function persistFile(ref: FileRef | null | undefined): Promise<FileRef | null> {
  if (!ref || !ref.url) return null;
  if (!ref.url.startsWith('data:')) return { url: ref.url, name: ref.name };
  const match = /^data:([^;]+);base64,(.*)$/s.exec(ref.url);
  if (!match) return null;
  const [, contentType, b64] = match;
  const id = await putMedia(contentType || 'application/octet-stream', Buffer.from(b64, 'base64'));
  return { url: `/api/media/${id}`, name: ref.name };
}

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  // Enforce auth only when a password is configured (open otherwise).
  if (
    process.env.ADMIN_PASSWORD &&
    !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { record?: Partial<InventoryRecord>; isNew?: boolean; deleteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let list: InventoryRecord[];
  try {
    list = await getInventory();
  } catch (e) {
    return NextResponse.json({ error: 'Could not read the ledger.', detail: String(e) }, { status: 500 });
  }

  // ----- Delete -----
  if (body.deleteId) {
    const next = list.filter((r) => r.id !== body.deleteId);
    await saveInventory(next);
    return NextResponse.json({ ok: true, deleted: body.deleteId });
  }

  const r = body.record || {};
  const isNew = !!body.isNew || !r.id;
  const id = r.id || randomUUID().replace(/-/g, '');
  const previous = list.find((x) => x.id === id);

  // ----- Sale gating: cannot be Sold without a Bill of Sale -----
  const billOfSale = await persistFile(r.sale?.billOfSale);
  let status: InventoryRecord['status'] = (r.status as InventoryRecord['status']) || 'in_stock';
  if (status === 'sold' && !billOfSale?.url) {
    return NextResponse.json(
      { error: 'Upload the Bill of Sale before marking this car as Sold.' },
      { status: 400 },
    );
  }

  // ----- Persist all file fields -----
  const purchaseInvoice = await persistFile(r.purchaseInvoice);
  const purchasePayment = await persistFile(r.purchasePayment);
  const saleInvoice = await persistFile(r.sale?.saleInvoice);
  const costs: CostItem[] = [];
  for (const c of r.costs || []) {
    const invoice = await persistFile(c.invoice);
    costs.push({
      id: c.id || randomUUID().replace(/-/g, ''),
      category: String(c.category || 'Other'),
      description: String(c.description || '').trim() || undefined,
      amount: num(c.amount),
      date: c.date || undefined,
      invoice,
    });
  }

  const hasSale =
    r.sale &&
    (r.sale.price != null || r.sale.buyer || r.sale.date || billOfSale || saleInvoice);

  const now = new Date().toISOString();
  const record: InventoryRecord = {
    id,
    vin: String(r.vin || '').trim(),
    year: r.year ? Number(r.year) : undefined,
    make: String(r.make || '').trim(),
    model: String(r.model || '').trim(),
    trim: String(r.trim || '').trim() || undefined,
    color: String(r.color || '').trim() || undefined,
    mileage: String(r.mileage || '').trim() || undefined,
    status,
    listingSlug: String(r.listingSlug || '').trim() || undefined,
    purchaseCost: num(r.purchaseCost),
    purchaseDate: r.purchaseDate || undefined,
    purchaseInvoiceNo: String(r.purchaseInvoiceNo || '').trim() || undefined,
    seller: String(r.seller || '').trim() || undefined,
    purchaseInvoice,
    purchasePayment,
    costs,
    sale: hasSale
      ? {
          price: r.sale?.price != null ? num(r.sale.price) : undefined,
          date: r.sale?.date || undefined,
          buyer: String(r.sale?.buyer || '').trim() || undefined,
          billOfSale,
          saleInvoice,
        }
      : undefined,
    notes: String(r.notes || '').trim() || undefined,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  if (!record.vin && !record.make && !record.model) {
    return NextResponse.json({ error: 'Enter at least a VIN or make/model.' }, { status: 400 });
  }

  const next = isNew && !previous ? [...list, record] : list.map((x) => (x.id === id ? record : x));

  try {
    await saveInventory(next);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed', detail: String(e) }, { status: 500 });
  }
}
