import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { type Agent, agentPhoto, defaultEmail } from '@/data/agents';
import ListingInquiryForm from './ListingInquiryForm';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

// The co-branded contact block on a for-sale listing. When `agent` is given it
// is personalised to that agent (photo, name, direct WhatsApp/Call/Email);
// otherwise it falls back to the house inbox.
export default async function AgentCard({
  agent,
  locale,
  carTitle,
  carSlug,
  shareUrl,
}: {
  agent?: Agent;
  locale: string;
  carTitle: string;
  carSlug: string;
  shareUrl: string;
}) {
  const t = await getTranslations({ locale, namespace: 'agent' });

  const email = agent?.email || defaultEmail;
  const photo = agent ? agentPhoto(agent) : null;
  const waText = encodeURIComponent(
    `${agent ? `Hi ${agent.name}, ` : ''}I'm interested in the ${carTitle}. ${shareUrl}`,
  );
  const mailSubject = encodeURIComponent(`Enquiry — ${carTitle}`);
  const mailBody = encodeURIComponent(`I'm interested in the ${carTitle}.\n${shareUrl}\n\n`);

  const actionBtn =
    'flex flex-1 items-center justify-center gap-2 border border-bone/20 px-4 py-3 text-[12px] uppercase tracking-label text-bone-muted transition-colors hover:border-brass hover:text-bone';

  return (
    <div className="border border-bone/12 bg-ink-800 p-7">
      {agent && (
        <div className="mb-2 text-[11px] uppercase tracking-label text-brass">{t('yourSpecialist')}</div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink-700">
          {photo ? (
            <Image src={photo} alt={agent?.name || ''} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-xl text-brass">
              {agent ? initials(agent.name) : 'CK'}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-serif text-xl text-bone">{agent?.name || 'CK Retro Garage'}</div>
          <div className="mt-0.5 text-sm text-bone-dim">{agent ? agent.scope : t('presentedBy')}</div>
          {agent?.languages?.length ? (
            <div className="mt-1 text-[11px] uppercase tracking-label text-bone-dim">
              {t('speaks')}: {agent.languages.join(' · ')}
            </div>
          ) : null}
        </div>
      </div>

      {/* Direct actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {agent?.whatsapp && (
          <a
            href={`https://wa.me/${agent.whatsapp}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className={actionBtn}
          >
            {t('whatsapp')}
          </a>
        )}
        {agent?.phone && (
          <a href={`tel:${agent.phone}`} className={actionBtn}>
            {t('call')}
          </a>
        )}
        <a href={`mailto:${email}?subject=${mailSubject}&body=${mailBody}`} className={actionBtn}>
          {t('email')}
        </a>
      </div>

      {/* Logged inquiry form */}
      <div className="mt-8 border-t border-bone/10 pt-7">
        <ListingInquiryForm carTitle={carTitle} carSlug={carSlug} agentId={agent?.id} />
      </div>
    </div>
  );
}
