import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getInventory, getCars } from '@/lib/store';
import { type InventoryRecord, vehicleTitle } from '@/data/inventory';
import InventoryEditor from '@/components/admin/InventoryEditor';

export const dynamic = 'force-dynamic';

const EMPTY: InventoryRecord = {
  id: '',
  vin: '',
  make: '',
  model: '',
  status: 'in_stock',
  purchaseCost: 0,
  costs: [],
};

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === 'new';
  const [list, cars] = await Promise.all([getInventory(), getCars()]);
  const record = isNew ? EMPTY : list.find((r) => r.id === id);
  if (!record) notFound();

  const listings = cars.map((c) => ({
    slug: c.slug,
    title: `${c.year} ${c.make} ${c.model}`,
    make: c.make,
    model: c.model,
    year: c.year,
    color: c.specs?.exterior || '',
    mileage: c.specs?.mileage || '',
  }));

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin/inventory" className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-900">
          ← Back to ledger
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">
          {isNew ? 'Add a car to the ledger' : `Edit — ${vehicleTitle(record)}`}
        </h1>
        {/* key forces a clean remount per record — without it, navigating
            between cars (or to "new") reuses the same client component and
            keeps the previous car's field/document state. */}
        <InventoryEditor key={isNew ? 'new' : record.id} record={record} isNew={isNew} listings={listings} />
      </div>
    </div>
  );
}
