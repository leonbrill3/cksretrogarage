import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import SellForm from '@/components/SellForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sell' });
  return { title: t('metaTitle'), description: t('intro') };
}

export default async function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sell');

  const assurances = ['reach', 'discreet', 'handled'] as const;

  return (
    <div className="pt-28">
      <section className="container-site py-16">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="eyebrow mb-6">{t('eyebrow')}</div>
            <h1 className="h-display text-4xl text-bone md:text-5xl">{t('title')}</h1>
            <p className="mt-7 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>

            <ul className="mt-12 space-y-6">
              {assurances.map((a) => (
                <li key={a} className="border-t border-bone/10 pt-5">
                  <div className="font-serif text-lg text-bone">{t(`assurances.${a}.title`)}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-bone-dim">
                    {t(`assurances.${a}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-ink-800 p-8 md:p-12">
            <SellForm />
          </div>
        </div>
      </section>
    </div>
  );
}
