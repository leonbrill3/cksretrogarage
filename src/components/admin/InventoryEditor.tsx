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
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const lbl = 'block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1';

// Plain upload (Bill of Sale / Sale Invoice) — no AI auto-fill.
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
        <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-900">
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
          <div className="flex min-w-0 items-center gap-2 text-sm">
            {isUploaded ? (
              <a href={value.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-700 hover:underline">
                {value.name || 'View file'}
              </a>
            ) : (
              <span className="truncate text-neutral-600">{value.name} {isPending ? '(will upload on save)' : ''}</span>
            )}
            <button type="button" onClick={() => onChange(null)} className="text-neutral-400 hover:text-red-600" title="Remove">×</button>
          </div>
        ) : (
          <span className="text-sm text-neutral-400">PDF or image</span>
        )}
      </div>
    </div>
  );
}

// Invoice upload that reads the file with Claude and auto-fills the fields.
// Drag-and-drop, prominent copy, reading state, and a "filled" confirmation.
function InvoiceDropzone({
  value,
  reading,
  filled,
  onFile,
}: {
  value: FileRef | null | undefined;
  reading: boolean;
  filled: boolean;
  onFile: (v: FileRef | null) => void;
}) {
  const [drag, setDrag] = useState(false);
  const isUploaded = value?.url && !value.url.startsWith('data:');

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(await readFile(f));
        }}
        className={`rounded-lg border-2 border-dashed transition-colors ${
          drag ? 'border-neutral-900 bg-neutral-50' : filled ? 'border-green-400 bg-green-50' : 'border-neutral-300 bg-white'
        }`}
      >
        {reading ? (
          <div className="px-4 py-6 text-center text-sm font-medium text-neutral-700">✦ Reading invoice with Claude…</div>
        ) : value ? (
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0 text-sm">
              {isUploaded ? (
                <a href={value.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-700 hover:underline">{value.name || 'View invoice'}</a>
              ) : (
                <span className="truncate text-neutral-600">{value.name} (will upload on save)</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-900">
                Replace
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onFile(await readFile(f)); e.target.value = ''; }} />
              </label>
              <button type="button" onClick={() => onFile(null)} className="text-sm text-neutral-400 hover:text-red-600">Remove</button>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer px-4 py-6 text-center">
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onFile(await readFile(f)); e.target.value = ''; }} />
            <div className="text-sm font-semibold text-neutral-900">✨ Upload invoice — auto-fills the fields</div>
            <div className="mt-1 text-xs text-neutral-500">Drag a PDF or photo here, or click to choose. Claude reads it and fills in the details for you.</div>
          </label>
        )}
      </div>
      {filled && <p className="mt-2 text-xs font-medium text-green-700">✨ Filled by Claude — please review the values below and fix anything that&apos;s off.</p>}
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
  const [reading, setReading] = useState<string | null>(null); // 'purchase' | cost id
  const [justFilled, setJustFilled] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState('');

  const num = (s: string) => Number(String(s).replace(/[^0-9.-]/g, '')) || 0;
  const addOns = costs.reduce((s, c) => s + num(String(c.amount)), 0);
  const total = num(purchaseCost) + addOns;
  const prof = salePrice.trim() ? num(salePrice) - total : null;

  // Briefly highlight the fields the AI just populated.
  const hl = (token: string) => (justFilled === token ? ' ring-2 ring-green-400 bg-green-50' : '');
  function flash(token: string) {
    setJustFilled(token);
    setTimeout(() => setJustFilled((cur) => (cur === token ? null : cur)), 4500);
  }

  async function extractInvoice(
    dataUrl: string,
    kind: 'cost' | 'purchase',
  ): Promise<{ amount?: number; date?: string; category?: string; description?: string; vendor?: string; invoiceNumber?: string; vin?: string; vehicleYear?: number; make?: string; model?: string; trim?: string; color?: string; mileage?: string } | null> {
    if (!dataUrl.startsWith('data:')) return null;
    try {
      const res = await fetch('/api/admin/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: dataUrl, kind }),
      });
      const data = await res.json();
      if (data.error === 'not_configured') {
        setAiNote('Auto-fill from invoices is off until an Anthropic API key is added. Enter the values manually for now.');
        return null;
      }
      if (!data.ok) return null;
      return data.fields || null;
    } catch {
      return null;
    }
  }

  async function onPurchaseInvoice(v: FileRef | null) {
    setPurchaseInvoice(v);
    if (!v?.url?.startsWith('data:')) return;
    setReading('purchase');
    const f = await extractInvoice(v.url, 'purchase');
    if (f) {
      if (f.amount) setPurchaseCost(String(f.amount));
      if (f.date) setPurchaseDate(f.date);
      if (f.invoiceNumber) setPurchaseInvoiceNo(f.invoiceNumber);
      if (f.vendor) setSeller(f.vendor);
      // Vehicle details from the bill of purchase
      if (f.vin) setVin(f.vin);
      if (f.make) setMake(f.make);
      if (f.model) setModel(f.model);
      if (f.vehicleYear) setYear(String(f.vehicleYear));
      if (f.trim) setTrim(f.trim);
      if (f.color) setColor(f.color);
      if (f.mileage) setMileage(f.mileage);
      flash('purchase');
    }
    setReading(null);
  }

  async function onCostInvoice(id: string, v: FileRef | null) {
    updateCost(id, { invoice: v });
    if (!v?.url?.startsWith('data:')) return;
    setReading(id);
    const f = await extractInvoice(v.url, 'cost');
    if (f) {
      const patch: Partial<CostItem> = {};
      if (f.amount) patch.amount = f.amount;
      if (f.date) patch.date = f.date;
      if (f.category && (COST_CATEGORIES as readonly string[]).includes(f.category)) patch.category = f.category;
      const desc = [f.description, f.vendor].filter(Boolean).join(' — ');
      if (desc) patch.description = desc;
      updateCost(id, patch);
      flash(id);
    }
    setReading(null);
  }

  // Selecting an existing website listing pulls its details across.
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

  const section = 'mt-10 border-t border-neutral-200 pt-8';
  const heading = 'mb-5 text-sm font-semibold uppercase tracking-wide text-neutral-900';
  const btnSecondary = 'rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-900';

  return (
    <div className="mt-6 pb-24">
      {/* AI tip banner */}
      <div className="mb-8 rounded-lg border border-neutral-900/10 bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
        💡 <strong className="font-semibold text-neutral-900">Tip:</strong> Upload an invoice on the Purchase or any Add-on Cost and Claude fills in the details automatically — you just review them.
      </div>

      {/* Pull from an existing website listing */}
      <section className="mb-8 rounded-lg border border-neutral-300 bg-neutral-50 p-5">
        <label className={lbl}>Already on the website? Select it to auto-fill the details</label>
        <select value={listingSlug} onChange={(e) => pickListing(e.target.value)} className={field}>
          <option value="">— not on the website / enter manually —</option>
          {listings.map((l) => <option key={l.slug} value={l.slug}>{l.title}</option>)}
        </select>
        {listingSlug && (
          <p className="mt-2 text-xs text-neutral-500">
            Linked to <span className="font-medium text-neutral-900">{listings.find((l) => l.slug === listingSlug)?.title}</span> — make, model &amp; year filled in below. You can still edit them.
          </p>
        )}
      </section>

      {/* Identity */}
      <section>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>VIN</label>
            <input value={vin} onChange={(e) => setVin(e.target.value)} className={`${field} font-mono${hl('purchase')}`} placeholder="Vehicle Identification Number" />
          </div>
          <div><label className={lbl}>Year</label><input value={year} onChange={(e) => setYear(e.target.value)} className={`${field}${hl('purchase')}`} placeholder="2008" /></div>
          <div><label className={lbl}>Make</label><input value={make} onChange={(e) => setMake(e.target.value)} className={`${field}${hl('purchase')}`} placeholder="Ferrari" /></div>
          <div><label className={lbl}>Model</label><input value={model} onChange={(e) => setModel(e.target.value)} className={`${field}${hl('purchase')}`} placeholder="599" /></div>
          <div><label className={lbl}>Trim (optional)</label><input value={trim} onChange={(e) => setTrim(e.target.value)} className={`${field}${hl('purchase')}`} /></div>
          <div><label className={lbl}>Color (optional)</label><input value={color} onChange={(e) => setColor(e.target.value)} className={`${field}${hl('purchase')}`} /></div>
          <div><label className={lbl}>Mileage (optional)</label><input value={mileage} onChange={(e) => setMileage(e.target.value)} className={`${field}${hl('purchase')}`} /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InventoryStatus)} className={field}>
              <option value="in_stock">In Stock</option>
              <option value="for_sale">For Sale</option>
              <option value="sold">Sold</option>
            </select>
            {status === 'sold' && !billOfSale && (
              <p className="mt-1.5 text-xs text-red-600">Requires a Bill of Sale (in the Sale section below).</p>
            )}
          </div>
        </div>
      </section>

      {/* Purchase — invoice first */}
      <section className={section}>
        <div className={heading}>Purchase</div>
        <p className="mb-3 -mt-2 text-sm text-neutral-500">Not on the website yet? Upload the bill of purchase and Claude fills in the car details (VIN, make, model, year) <em>and</em> the price below.</p>
        <InvoiceDropzone value={purchaseInvoice} reading={reading === 'purchase'} filled={justFilled === 'purchase'} onFile={onPurchaseInvoice} />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div><label className={lbl}>Purchase Cost (USD)</label><input value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} className={`${field}${hl('purchase')}`} placeholder="180000" /></div>
          <div><label className={lbl}>Purchase Date</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={`${field}${hl('purchase')}`} /></div>
          <div><label className={lbl}>Invoice # (optional)</label><input value={purchaseInvoiceNo} onChange={(e) => setPurchaseInvoiceNo(e.target.value)} className={`${field}${hl('purchase')}`} /></div>
          <div><label className={lbl}>Seller / Source (optional)</label><input value={seller} onChange={(e) => setSeller(e.target.value)} className={`${field}${hl('purchase')}`} /></div>
        </div>
      </section>

      {/* Add-on costs — invoice first per row */}
      <section className={section}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-900">Add-on Costs</div>
          <button type="button" onClick={addCost} className={btnSecondary}>+ Add cost</button>
        </div>
        {costs.length === 0 && (
          <button type="button" onClick={addCost} className="w-full rounded-lg border-2 border-dashed border-neutral-300 px-4 py-6 text-center hover:border-neutral-900">
            <div className="text-sm font-semibold text-neutral-900">+ Add a cost</div>
            <div className="mt-1 text-xs text-neutral-500">Parts, repairs, shipping, etc. — then upload the invoice and Claude fills it in.</div>
          </button>
        )}
        <div className="space-y-5">
          {costs.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <InvoiceDropzone value={c.invoice} reading={reading === c.id} filled={justFilled === c.id} onFile={(v) => onCostInvoice(c.id, v)} />
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <label className={lbl}>Category</label>
                  <select value={c.category} onChange={(e) => updateCost(c.id, { category: e.target.value })} className={`${field}${hl(c.id)}`}>
                    {COST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Amount (USD)</label><input value={String(c.amount ?? '')} onChange={(e) => updateCost(c.id, { amount: e.target.value as unknown as number })} className={`${field}${hl(c.id)}`} placeholder="0" /></div>
                <div><label className={lbl}>Date</label><input type="date" value={c.date || ''} onChange={(e) => updateCost(c.id, { date: e.target.value })} className={`${field}${hl(c.id)}`} /></div>
                <div className="flex items-end pb-1"><button type="button" onClick={() => removeCost(c.id)} className="text-sm text-neutral-400 hover:text-red-600" title="Remove">Remove</button></div>
              </div>
              <div className="mt-4"><label className={lbl}>Description (optional)</label><input value={c.description || ''} onChange={(e) => updateCost(c.id, { description: e.target.value })} className={`${field}${hl(c.id)}`} placeholder="e.g. new clutch, transport from Italy…" /></div>
            </div>
          ))}
        </div>
      </section>

      {/* Sale */}
      <section className={section}>
        <div className={heading}>Sale</div>
        <p className="mb-5 -mt-2 text-sm text-neutral-500">A car is only marked <strong className="text-neutral-700">Sold</strong> once the Bill of Sale is uploaded.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className={lbl}>Sale Price (USD)</label><input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={field} placeholder="240000" /></div>
          <div><label className={lbl}>Sale Date</label><input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={field} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Buyer (optional)</label><input value={buyer} onChange={(e) => setBuyer(e.target.value)} className={field} /></div>
          <div><FileField label="Bill of Sale" value={billOfSale} onChange={setBillOfSale} /></div>
          <div><FileField label="Sale Invoice (optional)" value={saleInvoice} onChange={setSaleInvoice} /></div>
        </div>
      </section>

      {/* Totals */}
      <section className={section}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Add-ons</div>
            <div className="mt-1 text-xl font-semibold text-neutral-900">{formatUSD(addOns)}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total Cost</div>
            <div className="mt-1 text-xl font-semibold text-neutral-900">{formatUSD(total)}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Profit</div>
            <div className={`mt-1 text-xl font-semibold ${prof == null ? 'text-neutral-400' : prof >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {prof == null ? '—' : formatUSD(prof)}
            </div>
          </div>
        </div>
      </section>

      {aiNote && <p className="mt-6 text-sm text-neutral-500">{aiNote}</p>}
      {msg && <p className="mt-6 text-sm text-red-600">{msg}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button onClick={save} disabled={busy} className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {busy ? 'Saving…' : isNew ? 'Add to ledger' : 'Save changes'}
        </button>
        {!isNew && (
          <button onClick={del} disabled={busy} className="text-sm text-neutral-500 hover:text-red-600">Delete</button>
        )}
      </div>
    </div>
  );
}
