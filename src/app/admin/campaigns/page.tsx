import Link from 'next/link';
import { getCampaigns, getCampaignFinds } from '@/lib/store';
import { campaignSummary } from '@/data/campaigns';
import { sourcesConfigured } from '@/lib/sourcing';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const [campaigns, finds] = await Promise.all([getCampaigns(), getCampaignFinds()]);
  const cfg = sourcesConfigured();

  const activeCount = (id: string) => finds.filter((f) => f.campaignId === id && f.status !== 'gone').length;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-900">
              ← Back to admin
            </Link>
            <h1 className="mt-3 text-2xl font-semibold">Sourcing Campaigns</h1>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Hunt live inventory across the web · monitored morning &amp; afternoon
            </div>
          </div>
          <Link
            href="/admin/campaigns/new"
            className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            + New Campaign
          </Link>
        </header>

        {!cfg.marketcheck && !cfg.web && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            ⚠ No sourcing provider configured. Set <code>ANTHROPIC_API_KEY</code> (web search — likely
            already set) and/or <code>MARKETCHECK_API_KEY</code> on Render to enable scraping.
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center text-neutral-500">
            No campaigns yet. Click <span className="font-medium text-neutral-900">+ New Campaign</span> to start hunting a car.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full border-collapse">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  {['Campaign', 'Criteria', 'Cadence', 'Status', 'Active finds', 'Last run'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100">
                    <td className="px-3 py-3 text-sm">
                      <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-neutral-900 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-600">{campaignSummary(c)}</td>
                    <td className="px-3 py-3 text-xs text-neutral-500">
                      {[c.runMorning ? 'AM' : null, c.runAfternoon ? 'PM' : null].filter(Boolean).join(' + ') || '—'}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'}`}>
                        {c.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-neutral-900">{activeCount(c.id)}</td>
                    <td className="px-3 py-3 text-xs text-neutral-500">
                      {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) : 'never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
