import { notFound } from 'next/navigation';
import { agentByToken, agentPhoto } from '@/data/agents';
import { forSaleCars, carImages, carTitle } from '@/data/cars';
import ShareCard from '@/components/agent/ShareCard';

export const dynamic = 'force-dynamic';

const SITE = 'https://cksretrogarage.com';

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
};

export default async function AgentDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const agent = agentByToken(token);
  if (!agent) notFound();

  const listings = forSaleCars();
  const photo = agentPhoto(agent);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Agent header */}
      <header className="mb-10 flex items-center gap-5 border-b border-bone/10 pb-8">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink-700">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={agent.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-xl text-brass">
              {agent.name.slice(0, 1)}
            </div>
          )}
        </div>
        <div>
          <div className="font-serif text-2xl text-bone">{agent.name}</div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-brass">
            {agent.title} · {agent.scope}
          </div>
        </div>
      </header>

      <div className="mb-6">
        <h1 className="font-serif text-xl text-bone">Share a listing</h1>
        <p className="mt-2 text-sm leading-relaxed text-bone-dim">
          Every link below is tagged to you — when a buyer opens it they see your photo and
          contact details, and any enquiry comes straight to you (and is logged centrally). Copy
          the link or send it by WhatsApp or email.
        </p>
      </div>

      {listings.length === 0 ? (
        <div className="border border-bone/10 bg-ink-800 p-8 text-center text-bone-muted">
          No cars are listed for sale right now.
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((car) => {
            const title = carTitle(car);
            const price = (car.price || '').trim() || 'Price on application';
            const status = STATUS_LABEL[car.status || 'available'];
            const url = `${SITE}/en/for-sale/${car.slug}?a=${agent.id}`;
            const message = `Thought of you — a ${title} currently available through CK Retro Garage (${price}).`;
            return (
              <ShareCard
                key={car.slug}
                title={title}
                price={price}
                status={status}
                cover={carImages(car)[0]}
                url={url}
                message={message}
              />
            );
          })}
        </div>
      )}

      <p className="mt-10 border-t border-bone/10 pt-6 text-xs text-bone-dim">
        This page is private to you. Keep the link to yourself — anyone with it can share listings
        as you.
      </p>
    </div>
  );
}
