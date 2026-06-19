import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { contacts } from '@/data/contacts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('metaTitle'), description: t('intro') };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const tc = await getTranslations('contacts');

  return (
    <div className="pt-28">
      <section className="container-site py-16">
        <div className="max-w-3xl">
          <div className="eyebrow mb-6">{t('eyebrow')}</div>
          <h1 className="h-display text-4xl text-bone md:text-6xl">{t('title')}</h1>
          <p className="mt-7 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-12 md:grid-cols-2">
          {contacts.map((c) => (
            <div key={c.id} className="reveal border-t border-bone/10 pt-6">
              <div className="eyebrow mb-3">{tc.has(`${c.id}.label`) ? tc(`${c.id}.label`) : c.scope}</div>
              <div className="font-serif text-2xl text-bone">{c.name}</div>
              <div className="mt-1 text-sm text-bone-dim">{tc.has(`${c.id}.scope`) ? tc(`${c.id}.scope`) : c.scope}</div>
              <a
                href={`mailto:${c.email}`}
                className="link-underline mt-4 inline-block text-sm text-brass"
              >
                {c.email}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-20 border-t border-bone/10 pt-12">
          <p className="max-w-xl text-base leading-relaxed text-bone-muted">{t('orSource')}</p>
          <Link href="/source" className="btn-primary mt-6">{t('sourceCta')}</Link>
        </div>
      </section>
    </div>
  );
}
