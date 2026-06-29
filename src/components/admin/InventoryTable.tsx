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
  in_stock: 'bg-bone/10 text-bone-muted',
  for_sale: 'bg-brass/15 text-brass',
  sold: 'bg-green-500/15 text-green-400',
};

export default function InventoryTable({ records }: { records: InventoryRecord[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | InventoryStatus>('all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!needle) return true;
      return [r.vin, r.make, r.model, r.year, r.sale?.buyer, r.seller]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
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
      'Total Cost', 'Sale Price', 'Profit', 'Buyer', 'Purchase Date', 'Sale Date', 'Listing',
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

  const docLink = 'rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-bone-dim hover:text-bone hover:bg-ink-600';

  function Docs({ r }: { r: InventoryRecord }) {
    const links: { href: string; label: string }[] = [];
    if (r.purchaseInvoice?.url) links.push({ href: r.purchaseInvoice.url, label: 'Purchase' });
    (r.costs || []).forEach((c, i) => {
      if (c.invoice?.url) links.push({ href: c.invoice.url, label: c.category || `Cost ${i + 1}` });
    });
    if (r.sale?.billOfSale?.url) links.push({ href: r.sale.billOfSale.url, label: 'Bill of Sale' });
    if (r.sale?.saleInvoice?.url) links.push({ href: r.sale.saleInvoice.url, label: 'Sale Inv.' });
    if (!links.length) return <span className="text-bone-dim/40">—</span>;
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

  const th = 'px-3 py-2 text-left text-[10px] font-medium uppercase tracking-label text-bone-dim whitespace-nowrap';
  const td = 'px-3 py-2.5 text-sm text-bone-muted whitespace-nowrap';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search VIN, make, model, buyer…"
          className="w-64 border-b border-bone/20 bg-transparent py-2 text-sm text-bone placeholder:text-bone-dim/60 focus:border-brass focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | InventoryStatus)}
          className="border border-bone/20 bg-ink-800 px-3 py-2 text-sm text-bone-muted focus:border-brass focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="for_sale">For Sale</option>
          <option value="sold">Sold</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-bone-dim">{rows.length} of {records.length}</span>
          <button onClick={exportCsv} className="border border-bone/20 px-3 py-2 text-[11px] uppercase tracking-label text-bone-muted hover:border-brass hover:text-bone">
            Export CSV
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="border border-bone/10 bg-ink-800 p-12 text-center text-bone-dim">
          No cars in the ledger yet. Click <span className="text-brass">+ Add Car</span> to record your first acquisition.
        </div>
      ) : (
        <div className="overflow-x-auto border border-bone/10">
          <table className="w-full border-collapse">
            <thead className="bg-ink-800">
              <tr>
                <th className={th}>VIN</th>
                <th className={th}>Year</th>
                <th className={th}>Make</th>
                <th className={th}>Model</th>
                <th className={th}>Status</th>
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
                    className="cursor-pointer border-t border-bone/8 transition-colors hover:bg-ink-800/60"
                  >
                    <td className={`${td} font-mono text-xs`}>{r.vin || '—'}</td>
                    <td className={td}>{r.year || '—'}</td>
                    <td className={`${td} text-bone`}>{r.make || '—'}</td>
                    <td className={`${td} text-bone`}>{r.model || '—'}</td>
                    <td className={td}>
                      <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-label ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className={`${td} text-right`}>{formatUSD(r.purchaseCost)}</td>
                    <td className={`${td} text-right`}>{formatUSD(addOnsTotal(r))}</td>
                    <td className={`${td} text-right font-medium text-bone`}>{formatUSD(totalCost(r))}</td>
                    <td className={`${td} text-right`}>{r.sale?.price != null ? formatUSD(r.sale.price) : '—'}</td>
                    <td className={`${td} text-right font-medium ${p == null ? '' : p >= 0 ? 'text-green-400' : 'text-oxblood-light'}`}>
                      {p == null ? '—' : formatUSD(p)}
                    </td>
                    <td className={td}><Docs r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-ink-800">
              <tr className="border-t-2 border-bone/20 font-medium text-bone">
                <td className={td} colSpan={5}>Totals ({rows.length})</td>
                <td className={`${td} text-right`}>{formatUSD(totals.purchase)}</td>
                <td className={`${td} text-right`}>{formatUSD(totals.addons)}</td>
                <td className={`${td} text-right`}>{formatUSD(totals.cost)}</td>
                <td className={`${td} text-right`}>{formatUSD(totals.sale)}</td>
                <td className={`${td} text-right ${totals.prof >= 0 ? 'text-green-400' : 'text-oxblood-light'}`}>{formatUSD(totals.prof)}</td>
                <td className={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
