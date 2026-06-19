import { notFound } from 'next/navigation';
import { agentByToken, agentPhoto } from '@/data/agents';
import { sellableCars, carImages, carTitle } from '@/data/cars';
import QuoteBuilder from '@/components/agent/QuoteBuilder';

export const dynamic = 'force-dynamic';

export default async function AgentDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const agent = agentByToken(token);
  if (!agent) notFound();

  const listings = sellableCars();
  const photo = agentPhoto(agent);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Agent header */}
      <header className="mb-8 flex items-center gap-5 border-b border-bone/10 pb-8">
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
          <div className="text-[11px] uppercase tracking-[0.22em] text-brass">{agent.title}</div>
        </div>
      </header>

      {/* How commission works — clear, up front */}
      <section className="mb-8 border border-brass/30 bg-ink-800 p-6">
        <h1 className="font-serif text-xl text-bone">How you get paid</h1>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-bone-muted">
          <li className="flex gap-3">
            <span className="text-brass">1.</span>
            <span>Each car has a <strong className="text-bone">minimum price</strong> set by CK — your floor. It is private; the customer never sees it.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-brass">2.</span>
            <span>You choose the <strong className="text-bone">asking price</strong> you quote your customer (at or above the minimum).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-brass">3.</span>
            <span>Your commission is <strong className="text-bone">70% of everything above the minimum</strong>. Sell at the minimum and you earn <strong className="text-bone">nothing</strong> — the higher you sell, the more you make.</span>
          </li>
        </ul>
        <div className="mt-4 rounded bg-ink-900/60 p-3 text-xs text-bone-dim">
          <strong className="text-bone">Example:</strong> minimum €100,000. You sell at €120,000 →
          €20,000 above the floor → <strong className="text-brass">you earn €14,000</strong> (70%), CK
          keeps €106,000.
        </div>
      </section>

      <div className="mb-5">
        <h2 className="font-serif text-lg text-bone">Send a quote</h2>
        <p className="mt-1 text-sm text-bone-dim">
          Set your asking price, pick the customer&apos;s language, and send the branded link by
          WhatsApp or email. Every enquiry comes straight to you.
        </p>
      </div>

      {listings.length === 0 ? (
        <div className="border border-bone/10 bg-ink-800 p-8 text-center text-bone-muted">
          No cars are available to quote yet. CK will mark cars sellable and set their minimum prices.
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((car) => (
            <QuoteBuilder
              key={car.slug}
              token={token}
              slug={car.slug}
              title={carTitle(car)}
              cover={carImages(car)[0]}
              minPrice={car.minPrice as number}
              currency={car.currency || 'EUR'}
            />
          ))}
        </div>
      )}

      <p className="mt-10 border-t border-bone/10 pt-6 text-xs text-bone-dim">
        This page is private to you and shows confidential minimum prices. Keep the link to yourself.
      </p>
    </div>
  );
}
