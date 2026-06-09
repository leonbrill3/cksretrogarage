import Image from 'next/image';
import Link from 'next/link';
import { cars, carImages, carTitle } from '@/data/cars';
import LogoutButton from '@/components/admin/LogoutButton';

export const dynamic = 'force-dynamic';

export default function AdminDashboard() {
  const configured = !!process.env.GITHUB_TOKEN && !!process.env.GITHUB_REPO;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <div className="font-serif text-2xl">CK Retro Garage</div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-brass">Inventory Admin</div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-bone-dim hover:text-bone" target="_blank">
            View site ↗
          </Link>
          <LogoutButton />
        </div>
      </header>

      {!configured && (
        <div className="mb-8 border border-oxblood/50 bg-oxblood-deep/30 p-4 text-sm text-bone-muted">
          ⚠️ <strong>GitHub not configured.</strong> Set <code>GITHUB_TOKEN</code> and{' '}
          <code>GITHUB_REPO</code> env vars on Render so saves can commit. Editing works, but
          saving will fail until then.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-xl">{cars.length} cars</h1>
        <Link href="/admin/cars/new" className="btn-primary !py-2.5">
          + Add Car
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cars.map((car) => (
          <Link
            key={car.slug}
            href={`/admin/cars/${car.slug}`}
            className="group flex gap-4 border border-bone/10 bg-ink-800 p-3 transition-colors hover:border-bone/30"
          >
            <div className="relative h-20 w-28 shrink-0 overflow-hidden bg-ink-700">
              <Image src={carImages(car)[0]} alt="" fill sizes="112px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-lg group-hover:text-brass">
                {carTitle(car)}
              </div>
              <div className="mt-1 text-xs text-bone-dim">
                {car.images.length} photos · {car.category}
                {car.featured ? ' · ★ featured' : ''}
              </div>
              <div className="mt-1 truncate text-xs text-bone-dim">{car.tagline.en}</div>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-bone-dim">
        Saving commits to GitHub and triggers a redeploy — changes appear on the live site in ~2
        minutes.
      </p>
    </div>
  );
}
