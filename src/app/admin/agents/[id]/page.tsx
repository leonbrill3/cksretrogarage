import { notFound } from 'next/navigation';
import Link from 'next/link';
import { type Agent } from '@/data/agents';
import { getAgents } from '@/lib/store';
import AgentEditor from '@/components/admin/AgentEditor';

export const dynamic = 'force-dynamic';

async function loadAgent(id: string): Promise<Agent | undefined> {
  const list = await getAgents();
  return list.find((a) => a.id === id);
}

const EMPTY: Agent = {
  id: '',
  name: '',
  title: 'Partner',
  scope: '',
  email: '',
  phone: '',
  whatsapp: '',
  languages: [],
  photo: '',
  token: '',
  match: [],
};

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === 'new';
  const agent = isNew ? EMPTY : await loadAgent(id);
  if (!agent) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[11px] uppercase tracking-[0.22em] text-bone-dim hover:text-bone">
        ← Back to inventory
      </Link>
      <h1 className="mt-4 font-serif text-2xl">{isNew ? 'Add an agent' : `Edit — ${agent.name}`}</h1>
      <AgentEditor agent={agent} isNew={isNew} />
    </div>
  );
}
