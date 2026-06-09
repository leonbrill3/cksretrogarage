import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCar, type Car } from '@/data/cars';
import CarEditor from '@/components/admin/CarEditor';

export const dynamic = 'force-dynamic';

const EMPTY: Car = {
  slug: '',
  year: new Date().getFullYear(),
  make: '',
  model: '',
  category: 'collector',
  featured: false,
  images: [],
  tagline: { en: '', tr: '' },
  description: { en: '', tr: '' },
  inspection: { en: [], tr: [] },
};

export default async function EditCarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const isNew = slug === 'new';
  const car = isNew ? EMPTY : getCar(slug);
  if (!car) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[11px] uppercase tracking-[0.22em] text-bone-dim hover:text-bone">
        ← Back to inventory
      </Link>
      <h1 className="mt-4 font-serif text-2xl">
        {isNew ? 'Add a car' : `Edit — ${car.year} ${car.make} ${car.model}`}
      </h1>
      <CarEditor car={car} isNew={isNew} />
    </div>
  );
}
