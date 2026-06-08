import { Link } from '@/i18n/routing';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="font-serif text-7xl text-bone/20">404</div>
      <h1 className="mt-6 font-serif text-3xl text-bone">This page could not be found.</h1>
      <Link href="/" className="btn-ghost mt-8">
        Return Home
      </Link>
    </div>
  );
}
