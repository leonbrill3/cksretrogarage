import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCampaigns, getCampaignFinds, getCampaignRuns } from '@/lib/store';
import type { Campaign } from '@/data/campaigns';
import CampaignEditor from '@/components/admin/CampaignEditor';
import { sourcesConfigured } from '@/lib/sourcing';

export const dynamic = 'force-dynamic';

const EMPTY: Campaign = {
  id: '',
  name: '',
  make: 'Ferrari',
  model: '',
  countries: ['US'],
  runMorning: true,
  runAfternoon: true,
  status: 'active',
  createdAt: '',
  updatedAt: '',
};

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  const [campaigns, allFinds, allRuns] = await Promise.all([getCampaigns(), getCampaignFinds(), getCampaignRuns()]);
  const campaign = isNew ? EMPTY : campaigns.find((c) => c.id === id);
  if (!campaign) notFound();

  const finds = isNew ? [] : allFinds.filter((f) => f.campaignId === id).sort((a, b) => (b.firstSeenAt < a.firstSeenAt ? -1 : 1));
  const lastRun = isNew ? undefined : allRuns.find((r) => r.campaignId === id);
  const cfg = sourcesConfigured();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin/campaigns" className="text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-900">
          ← Back to campaigns
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{isNew ? 'New sourcing campaign' : campaign.name}</h1>
        <CampaignEditor
          key={isNew ? 'new' : campaign.id}
          campaign={campaign}
          isNew={isNew}
          finds={finds}
          lastRun={lastRun}
          sourcesReady={cfg.marketcheck || cfg.web}
          sourceLabels={{ marketcheck: cfg.marketcheck, web: cfg.web }}
        />
      </div>
    </div>
  );
}
