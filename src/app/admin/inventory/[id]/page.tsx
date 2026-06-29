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

  const listings = cars.map((c) => ({ slug: c.slug, title: `${c.year} ${c.make} ${c.model}` }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/inventory" className="text-[11px] uppercase tracking-[0.22em] text-bone-dim hover:text-bone">
        ← Back to ledger
      </Link>
      <h1 className="mt-4 font-serif text-2xl">
        {isNew ? 'Add a car to the ledger' : `Edit — ${vehicleTitle(record)}`}
      </h1>
      <InventoryEditor record={record} isNew={isNew} listings={listings} />
    </div>
  );
}
