'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type InventoryRecord,
  type CostItem,
  type FileRef,
  type InventoryStatus,
  COST_CATEGORIES,
  formatUSD,
} from '@/data/inventory';

function readFile(file: File): Promise<FileRef> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: String(reader.result), name: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const field =
  'w-full border-b border-bone/20 bg-transparent py-2.5 text-bone placeholder:text-bone-dim/50 focus:border-brass focus:outline-none transition-colors';
const lbl = 'block text-[11px] uppercase tracking-label text-bone-dim mb-1.5';

function FileField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FileRef | null | undefined;
  onChange: (v: FileRef | null) => void;
}) {
  const isUploaded = value?.url && !value.url.startsWith('data:');
  const isPending = value?.url && value.url.startsWith('data:');
  return (
    <div>
      <span className={lbl}>{label}</span>
      <div className="flex items-center gap-3">
        <label className="cursor-pointer border border-bone/20 px-3 py-2 text-[11px] uppercase tracking-label text-bone-muted hover:border-brass hover:text-bone">
          {value ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onChange(await readFile(f));
              e.target.value = '';
            }}
          />
        </label>
        {value ? (
          <div className="flex min-w-0 items-center gap-2 text-xs">
            {isUploaded ? (
              <a href={value.url} target="_blank" rel="noopener noreferrer" className="truncate text-brass hover:underline">
                {value.name || 'View file'}
              </a>
            ) : (
              <span className="truncate text-bone-muted">{value.name} {isPending ? '(will upload on save)' : ''}</span>
            )}
            <button type="button" onClick={() => onChange(null)} className="text-bone-dim hover:text-oxblood-light" title="Remove">×</button>
          </div>
        ) : (
          <span className="text-xs text-bone-dim/50">PDF or image</span>
        )}
      </div>
    </div>
  );
}

export default function InventoryEditor({
  record,
  isNew,
  listings,
}: {
  record: InventoryRecord;
  isNew: boolean;
  listings: { slug: string; title: string; make: string; model: string; year: number; color?: string; mileage?: string }[];
}) {
  const router = useRouter();

  const [vin, setVin] = useState(record.vin || '');
  const [year, setYear] = useState(record.year ? String(record.year) : '');
  const [make, setMake] = useState(record.make || '');
  const [model, setModel] = useState(record.model || '');
  const [trim, setTrim] = useState(record.trim || '');
  const [color, setColor] = useState(record.color || '');
  const [mileage, setMileage] = useState(record.mileage || '');
  const [status, setStatus] = useState<InventoryStatus>(record.status || 'in_stock');
  const [listingSlug, setListingSlug] = useState(record.listingSlug || '');

  const [purchaseCost, setPurchaseCost] = useState(record.purchaseCost ? String(record.purchaseCost) : '');
  const [purchaseDate, setPurchaseDate] = useState(record.purchaseDate || '');
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState(record.purchaseInvoiceNo || '');
  const [seller, setSeller] = useState(record.seller || '');
  const [purchaseInvoice, setPurchaseInvoice] = useState<FileRef | null>(record.purchaseInvoice || null);

  const [costs, setCosts] = useState<CostItem[]>(record.costs || []);

  const [salePrice, setSalePrice] = useState(record.sale?.price != null ? String(record.sale.price) : '');
  const [saleDate, setSaleDate] = useState(record.sale?.date || '');
  const [buyer, setBuyer] = useState(record.sale?.buyer || '');
  const [billOfSale, setBillOfSale] = useState<FileRef | null>(record.sale?.billOfSale || null);
  const [saleInvoice, setSaleInvoice] = useState<FileRef | null>(record.sale?.saleInvoice || null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const num = (s: string) => Number(String(s).replace(/[^0-9.-]/g, '')) || 0;
  const addOns = costs.reduce((s, c) => s + num(String(c.amount)), 0);
  const total = num(purchaseCost) + addOns;
  const prof = salePrice.trim() ? num(salePrice) - total : null;

  // Selecting an existing website listing pulls its details across so they
  // don't have to be re-typed.
  function pickListing(slug: string) {
    setListingSlug(slug);
    const l = listings.find((x) => x.slug === slug);
    if (!l) return;
    setMake(l.make || '');
    setModel(l.model || '');
    setYear(l.year ? String(l.year) : '');
    if (l.color) setColor(l.color);
    if (l.mileage) setMileage(l.mileage);
  }

  function newCostId() {
    try { return crypto.randomUUID().replace(/-/g, ''); } catch { return `c${costs.length}-${Date.now()}`; }
  }
  function addCost() {
    setCosts((c) => [...c, { id: newCostId(), category: 'Parts', amount: 0 }]);
  }
  function updateCost(id: string, patch: Partial<CostItem>) {
    setCosts((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeCost(id: string) {
    setCosts((c) => c.filter((x) => x.id !== id));
  }

  async function save() {
    if (status === 'sold' && !billOfSale) {
      setMsg('Upload the Bill of Sale before marking this car as Sold.');
      return;
    }
    setBusy(true);
    setMsg('');
    const hasSale = !!(salePrice.trim() || buyer.trim() || saleDate || billOfSale || saleInvoice);
    const payload = {
      isNew,
      record: {
        id: record.id || undefined,
        vin, year: year ? Number(year) : undefined, make, model, trim, color, mileage,
        status, listingSlug: listingSlug || undefined,
        purchaseCost: num(purchaseCost), purchaseDate, purchaseInvoiceNo, seller, purchaseInvoice,
        costs: costs.map((c) => ({ ...c, amount: num(String(c.amount)) })),
        sale: hasSale
          ? {
              price: salePrice.trim() ? num(salePrice) : undefined,
              date: saleDate, buyer, billOfSale, saleInvoice,
            }
          : undefined,
        notes: record.notes,
      },
    };
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      router.push('/admin/inventory');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm('Delete this car from the ledger? This cannot be undone.')) return;
    setBusy(true);
    await fetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteId: record.id }),
    });
    router.push('/admin/inventory');
    router.refresh();
  }

  const section = 'mt-10 border-t border-bone/10 pt-8';
  const heading = 'mb-5 text-[11px] uppercase tracking-[0.22em] text-brass';

  return (
    <div className="mt-6 pb-24">
      {/* Pull from an existing website listing */}
      <section className="mb-8 border border-brass/25 bg-ink-800/50 p-5">
        <label className={lbl}>Already on the website? Select it to auto-fill the details</label>
        <select value={listingSlug} onChange={(e) => pickListing(e.target.value)} className={`${field} bg-ink-800`}>
          <option value="">— not on the website / enter manually —</option>
          {listings.map((l) => <option key={l.slug} value={l.slug}>{l.title}</option>)}
        </select>
        {listingSlug && (
          <p className="mt-2 text-[11px] text-bone-dim">
            Linked to <span className="text-brass">{listings.find((l) => l.slug === listingSlug)?.title}</span> — make, model & year filled in below. You can still edit them.
          </p>
        )}
      </section>

      {/* Identity */}
      <section>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>VIN</label>
            <input value={vin} onChange={(e) => setVin(e.target.value)} className={`${field} font-mono`} placeholder="Vehicle Identification Number" />
          </div>
          <div><label className={lbl}>Year</label><input value={year} onChange={(e) => setYear(e.target.value)} className={field} placeholder="2008" /></div>
          <div><label className={lbl}>Make</label><input value={make} onChange={(e) => setMake(e.target.value)} className={field} placeholder="Ferrari" /></div>
          <div><label className={lbl}>Model</label><input value={model} onChange={(e) => setModel(e.target.value)} className={field} placeholder="599" /></div>
          <div><label className={lbl}>Trim (optional)</label><input value={trim} onChange={(e) => setTrim(e.target.value)} className={field} /></div>
          <div><label className={lbl}>Color (optional)</label><input value={color} onChange={(e) => setColor(e.target.value)} className={field} /></div>
          <div><label className={lbl}>Mileage (optional)</label><input value={mileage} onChange={(e) => setMileage(e.target.value)} className={field} /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InventoryStatus)} className={`${field} bg-ink-800`}>
              <option value="in_stock">In Stock</option>
              <option value="for_sale">For Sale</option>
              <option value="sold">Sold</option>
            </select>
            {status === 'sold' && !billOfSale && (
              <p className="mt-1.5 text-[11px] text-oxblood-light">Requires a Bill of Sale (in the Sale section below).</p>
            )}
          </div>
        </div>
      </section>

      {/* Purchase */}
      <section className={section}>
        <div className={heading}>Purchase</div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className={lbl}>Purchase Cost (USD)</label><input value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} className={field} placeholder="180000" /></div>
          <div><label className={lbl}>Purchase Date</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={`${field} bg-ink-800`} /></div>
          <div><label className={lbl}>Invoice # (optional)</label><input value={purchaseInvoiceNo} onChange={(e) => setPurchaseInvoiceNo(e.target.value)} className={field} /></div>
          <div><label className={lbl}>Seller / Source (optional)</label><input value={seller} onChange={(e) => setSeller(e.target.value)} className={field} /></div>
          <div className="sm:col-span-2"><FileField label="Purchase Invoice" value={purchaseInvoice} onChange={setPurchaseInvoice} /></div>
        </div>
      </section>

      {/* Add-on costs */}
      <section className={section}>
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.22em] text-brass">Add-on Costs</div>
          <button type="button" onClick={addCost} className="border border-bone/20 px-3 py-1.5 text-[11px] uppercase tracking-label text-bone-muted hover:border-brass hover:text-bone">+ Add cost</button>
        </div>
        {costs.length === 0 && <p className="text-sm text-bone-dim/60">No add-on costs yet — parts, repairs, shipping, etc.</p>}
        <div className="space-y-5">
          {costs.map((c) => (
            <div key={c.id} className="border border-bone/10 bg-ink-800/40 p-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <label className={lbl}>Category</label>
                  <select value={c.category} onChange={(e) => updateCost(c.id, { category: e.target.value })} className={`${field} bg-ink-800`}>
                    {COST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Amount (USD)</label><input value={String(c.amount ?? '')} onChange={(e) => updateCost(c.id, { amount: e.target.value as unknown as number })} className={field} placeholder="0" /></div>
                <div><label className={lbl}>Date</label><input type="date" value={c.date || ''} onChange={(e) => updateCost(c.id, { date: e.target.value })} className={`${field} bg-ink-800`} /></div>
                <div className="flex items-end pb-1"><button type="button" onClick={() => removeCost(c.id)} className="text-bone-dim hover:text-oxblood-light" title="Remove">Remove</button></div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div><label className={lbl}>Description (optional)</label><input value={c.description || ''} onChange={(e) => updateCost(c.id, { description: e.target.value })} className={field} placeholder="e.g. new clutch, transport from Italy…" /></div>
                <FileField label="Invoice" value={c.invoice} onChange={(v) => updateCost(c.id, { invoice: v })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sale */}
      <section className={section}>
        <div className={heading}>Sale</div>
        <p className="mb-5 -mt-2 text-xs text-bone-dim">A car is only marked <strong className="text-bone-muted">Sold</strong> once the Bill of Sale is uploaded.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className={lbl}>Sale Price (USD)</label><input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={field} placeholder="240000" /></div>
          <div><label className={lbl}>Sale Date</label><input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={`${field} bg-ink-800`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Buyer (optional)</label><input value={buyer} onChange={(e) => setBuyer(e.target.value)} className={field} /></div>
          <div><FileField label="Bill of Sale" value={billOfSale} onChange={setBillOfSale} /></div>
          <div><FileField label="Sale Invoice (optional)" value={saleInvoice} onChange={setSaleInvoice} /></div>
        </div>
      </section>

      {/* Totals */}
      <section className={section}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border border-bone/10 bg-ink-800 p-4">
            <div className="text-[11px] uppercase tracking-label text-bone-dim">Add-ons</div>
            <div className="mt-1 font-serif text-xl text-bone">{formatUSD(addOns)}</div>
          </div>
          <div className="border border-bone/10 bg-ink-800 p-4">
            <div className="text-[11px] uppercase tracking-label text-bone-dim">Total Cost</div>
            <div className="mt-1 font-serif text-xl text-bone">{formatUSD(total)}</div>
          </div>
          <div className="border border-bone/10 bg-ink-800 p-4">
            <div className="text-[11px] uppercase tracking-label text-bone-dim">Profit</div>
            <div className={`mt-1 font-serif text-xl ${prof == null ? 'text-bone-dim' : prof >= 0 ? 'text-green-400' : 'text-oxblood-light'}`}>
              {prof == null ? '—' : formatUSD(prof)}
            </div>
          </div>
        </div>
      </section>

      {msg && <p className="mt-6 text-sm text-oxblood-light">{msg}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? 'Saving…' : isNew ? 'Add to ledger' : 'Save changes'}
        </button>
        {!isNew && (
          <button onClick={del} disabled={busy} className="text-sm text-bone-dim hover:text-oxblood-light">Delete</button>
        )}
      </div>
    </div>
  );
}
