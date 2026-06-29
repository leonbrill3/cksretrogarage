import Link from 'next/link';
import { getInventory } from '@/lib/store';
import InventoryTable from '@/components/admin/InventoryTable';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const records = await getInventory();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-900">
              ← Back to admin
            </Link>
            <h1 className="mt-3 text-2xl font-semibold">Inventory Ledger</h1>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Confidential · buy / sell · all amounts USD
            </div>
          </div>
          <Link
            href="/admin/inventory/new"
            className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            + Add Car
          </Link>
        </header>

        <InventoryTable records={records} />
      </div>
    </div>
  );
}
