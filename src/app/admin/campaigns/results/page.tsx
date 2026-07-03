import Link from 'next/link';
import { getCampaigns, getCampaignFinds, getCampaignRuns } from '@/lib/store';
import CampaignResults from '@/components/admin/CampaignResults';

export const dynamic = 'force-dynamic';

export default async function CampaignResultsPage() {
  const [campaigns, finds, runs] = await Promise.all([
    getCampaigns(),
    getCampaignFinds(),
    getCampaignRuns(),
  ]);
  const campaignList = campaigns.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <Link href="/admin/campaigns" className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-900">
            ← Back to campaigns
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">All Results</h1>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Every car found across all sourcing campaigns
          </div>
        </header>

        <CampaignResults finds={finds} campaigns={campaignList} runs={runs} />
      </div>
    </div>
  );
}
