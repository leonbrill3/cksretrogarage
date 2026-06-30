'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type InventoryRecord,
  type InventoryStatus,
  STATUS_LABELS,
  addOnsTotal,
  totalCost,
  profit,
  formatUSD,
} from '@/data/inventory';

const STATUS_STYLE: Record<InventoryStatus, string> = {
  in_stock: 'bg-neutral-200 text-neutral-700',
  for_sale: 'bg-amber-100 text-amber-800',
  sold: 'bg-green-100 text-green-700',
};

export default function InventoryTable({ records }: { records: InventoryRecord[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | InventoryStatus>('all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = records.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!needle) return true;
      return [r.vin, r.make, r.model, r.year, r.sale?.buyer, r.seller]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    // Order by purchase date — earliest acquisition first, regardless of when
    // the row was added. Cars with no purchase date sink to the bottom.
    const ts = (d?: string) => {
      if (!d) return Number.POSITIVE_INFINITY;
      const t = Date.parse(d);
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };
    return filtered.sort((a, b) => {
      const diff = ts(a.purchaseDate) - ts(b.purchaseDate);
      if (diff !== 0) return diff;
      return ts(a.createdAt) - ts(b.createdAt); // stable tiebreak by add order
    });
  }, [records, q, status]);

  const totals = useMemo(() => {
    let purchase = 0,
      addons = 0,
      cost = 0,
      sale = 0,
      prof = 0;
    for (const r of rows) {
      purchase += Number(r.purchaseCost) || 0;
      addons += addOnsTotal(r);
      cost += totalCost(r);
      if (typeof r.sale?.price === 'number') {
        sale += r.sale.price;
        const p = profit(r);
        if (typeof p === 'number') prof += p;
      }
    }
    return { purchase, addons, cost, sale, prof };
  }, [rows]);

  function exportCsv() {
    const header = [
      'VIN', 'Year', 'Make', 'Model', 'Status', 'Purchase Cost', 'Add-ons',
      'Total Cost', 'Sale Price', 'Profit', 'Buyer', 'Purchase Date', 'Sale Date', 'Listing', 'Added', 'Updated',
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      const p = profit(r);
      lines.push(
        [
          r.vin, r.year ?? '', r.make, r.model, STATUS_LABELS[r.status],
          r.purchaseCost || 0, addOnsTotal(r), totalCost(r),
          r.sale?.price ?? '', p ?? '', r.sale?.buyer ?? '',
          r.purchaseDate ?? '', r.sale?.date ?? '', r.listingSlug ?? '',
          r.createdAt ?? '', r.updatedAt ?? '',
        ]
          .map(esc)
          .join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ck-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Short "when added" label, e.g. "Jun 30, 2:15 PM" (full timestamp on hover).
  function fmtAdded(iso?: string): { short: string; full: string } {
    if (!iso) return { short: '—', full: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { short: '—', full: '' };
    const short = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    const full = d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });
    return { short, full };
  }

  const docLink = 'rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900';

  function Docs({ r }: { r: InventoryRecord }) {
    const links: { href: string; label: string }[] = [];
    if (r.purchaseInvoice?.url) links.push({ href: r.purchaseInvoice.url, label: 'Purchase' });
    if (r.purchasePayment?.url) links.push({ href: r.purchasePayment.url, label: 'Wire' });
    (r.purchasePayments || []).forEach((p, i) => {
      if (p.file?.url) links.push({ href: p.file.url, label: `Wire ${i + 1}` });
    });
    (r.costs || []).forEach((c, i) => {
      if (c.invoice?.url) links.push({ href: c.invoice.url, label: c.category || `Cost ${i + 1}` });
    });
    if (r.sale?.billOfSale?.url) links.push({ href: r.sale.billOfSale.url, label: 'Bill of Sale' });
    if (r.sale?.saleInvoice?.url) links.push({ href: r.sale.saleInvoice.url, label: 'Sale Inv.' });
    (r.sale?.payments || []).forEach((p, i) => {
      if (p.file?.url) links.push({ href: p.file.url, label: `Payment ${i + 1}` });
    });
    if (!links.length) return <span className="text-neutral-300">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {links.map((l, i) => (
          <a
            key={i}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={docLink}
            title={l.label}
          >
            {l.label}
          </a>
        ))}
      </div>
    );
  }

  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap';
  const td = 'px-3 py-3 text-sm text-neutral-700 whitespace-nowrap';
  const inputBase = 'rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search VIN, make, model, buyer…"
          className={`${inputBase} w-72 placeholder:text-neutral-400`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | InventoryStatus)} className={inputBase}>
          <option value="all">All statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="for_sale">For Sale</option>
          <option value="sold">Sold</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-neutral-500">{rows.length} of {records.length}</span>
          <button onClick={exportCsv} className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-900">
            Export CSV
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center text-neutral-500">
          No cars in the ledger yet. Click <span className="font-medium text-neutral-900">+ Add Car</span> to record your first acquisition.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full border-collapse">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className={th}>VIN</th>
                <th className={th}>Year</th>
                <th className={th}>Make</th>
                <th className={th}>Model</th>
                <th className={th}>Status</th>
                <th className={th}>Added</th>
                <th className={th}>Purchased</th>
                <th className={`${th} text-right`}>Purchase</th>
                <th className={`${th} text-right`}>Add-ons</th>
                <th className={`${th} text-right`}>Total Cost</th>
                <th className={`${th} text-right`}>Sale Price</th>
                <th className={`${th} text-right`}>Profit</th>
                <th className={th}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = profit(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/inventory/${r.id}`)}
                    className="cursor-pointer border-t border-neutral-100 transition-colors hover:bg-neutral-50"
                  >
                    <td className={`${td} font-mono text-xs`}>{r.vin || '—'}</td>
                    <td className={td}>{r.year || '—'}</td>
                    <td className={`${td} font-medium text-neutral-900`}>{r.make || '—'}</td>
                    <td className={`${td} font-medium text-neutral-900`}>{r.model || '—'}</td>
                    <td className={td}>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className={`${td} text-xs text-neutral-500`} title={fmtAdded(r.createdAt).full}>{fmtAdded(r.createdAt).short}</td>
                    <td className={td}>{r.purchaseDate || '—'}</td>
                    <td className={`${td} text-right`}>{formatUSD(r.purchaseCost)}</td>
                    <td className={`${td} text-right`}>{formatUSD(addOnsTotal(r))}</td>
                    <td className={`${td} text-right font-semibold text-neutral-900`}>{formatUSD(totalCost(r))}</td>
                    <td className={`${td} text-right`}>{r.sale?.price != null ? formatUSD(r.sale.price) : '—'}</td>
                    <td className={`${td} text-right font-semibold ${p == null ? '' : p >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {p == null ? '—' : formatUSD(p)}
                    </td>
                    <td className={td}><Docs r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-neutral-300 bg-neutral-50">
              <tr className="font-semibold text-neutral-900">
                <td className={td} colSpan={7}>Totals ({rows.length})</td>
                <td className={`${td} text-right`}>{formatUSD(totals.purchase)}</td>
                <td className={`${td} text-right`}>{formatUSD(totals.addons)}</td>
                <td className={`${td} text-right`}>{formatUSD(totals.cost)}</td>
                <td className={`${td} text-right`}>{formatUSD(totals.sale)}</td>
                <td className={`${td} text-right ${totals.prof >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatUSD(totals.prof)}</td>
                <td className={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
