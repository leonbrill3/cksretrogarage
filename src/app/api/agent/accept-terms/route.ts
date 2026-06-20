import { NextRequest, NextResponse } from 'next/server';
import { commitFiles, getRepoJson } from '@/lib/github';
import { AGREEMENT_VERSION } from '@/lib/agent-agreement';
import type { Agent } from '@/data/agents';

export const runtime = 'nodejs';

// Record an agent's acceptance of the agreement (authenticated by their token).
export async function POST(req: NextRequest) {
  let token = '';
  try {
    ({ token } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  let list: Agent[];
  try {
    list = await getRepoJson<Agent[]>('content/agents.json');
  } catch (e) {
    return NextResponse.json({ error: 'Could not read agents', detail: String(e) }, { status: 500 });
  }

  const agent = list.find((a) => a.token && a.token === token);
  if (!agent) return NextResponse.json({ error: 'Unknown agent' }, { status: 401 });

  agent.acceptedTermsAt = new Date().toISOString();
  agent.acceptedTermsVersion = AGREEMENT_VERSION;

  try {
    await commitFiles({
      message: `agent: ${agent.id} accepted agreement ${AGREEMENT_VERSION}`,
      textFiles: [{ path: 'content/agents.json', content: JSON.stringify(list, null, 2) + '\n' }],
    });
    // No redeploy needed — the dashboard reads agents.json live from GitHub.
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Commit failed', detail: String(e) }, { status: 500 });
  }
}
