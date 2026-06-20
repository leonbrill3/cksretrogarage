import { notFound } from 'next/navigation';
import Link from 'next/link';
import { type Car } from '@/data/cars';
import { getCars, getAgents } from '@/lib/store';
import CarEditor from '@/components/admin/CarEditor';

export const dynamic = 'force-dynamic';

async function loadCar(slug: string): Promise<Car | undefined> {
  const list = await getCars();
  return list.find((c) => c.slug === slug);
}

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
  const [car, allAgents] = await Promise.all([isNew ? EMPTY : loadCar(slug), getAgents()]);
  if (!car) notFound();
  const agents = allAgents
    .filter((a) => a.email && a.token)
    .map((a) => ({ id: a.id, name: a.name, email: a.email }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[11px] uppercase tracking-[0.22em] text-bone-dim hover:text-bone">
        ← Back to inventory
      </Link>
      <h1 className="mt-4 font-serif text-2xl">
        {isNew ? 'Add a car' : `Edit — ${car.year} ${car.make} ${car.model}`}
      </h1>
      <CarEditor car={car} isNew={isNew} agents={agents} />
    </div>
  );
}
