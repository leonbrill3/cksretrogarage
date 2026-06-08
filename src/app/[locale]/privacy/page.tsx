import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return { title: t('title') };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');

  const sections = ['collect', 'use', 'share', 'rights', 'contact'] as const;

  return (
    <div className="container-site max-w-3xl pb-28 pt-36">
      <h1 className="h-display text-4xl text-bone">{t('title')}</h1>
      <p className="mt-6 text-sm text-bone-dim">{t('intro')}</p>
      <div className="mt-12 space-y-10">
        {sections.map((s) => (
          <section key={s}>
            <h2 className="font-serif text-xl text-bone">{t(`sections.${s}.title`)}</h2>
            <p className="mt-3 text-sm leading-relaxed text-bone-muted">{t(`sections.${s}.body`)}</p>
          </section>
        ))}
      </div>
      <p className="mt-12 text-xs text-bone-dim">{t('disclaimer')}</p>
    </div>
  );
}
