import Link from 'next/link';
import { getInventory } from '@/lib/store';
import InventoryTable from '@/components/admin/InventoryTable';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const records = await getInventory();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-[11px] uppercase tracking-[0.22em] text-bone-dim hover:text-bone">
            ← Back to admin
          </Link>
          <div className="mt-3 font-serif text-2xl">Inventory Ledger</div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-brass">
            Confidential · buy / sell · all amounts USD
          </div>
        </div>
        <Link href="/admin/inventory/new" className="btn-primary !py-2.5">
          + Add Car
        </Link>
      </header>

      <InventoryTable records={records} />
    </div>
  );
}
