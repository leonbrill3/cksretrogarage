import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { commitFiles, getRepoJson } from '@/lib/github';

export const runtime = 'nodejs';

async function triggerRedeploy(): Promise<void> {
  const hook = process.env.RENDER_DEPLOY_HOOK;
  if (hook) {
    await fetch(hook, { method: 'POST' }).catch(() => {});
    return;
  }
  const key = process.env.RENDER_API_KEY;
  const svc = process.env.RENDER_SERVICE_ID;
  if (key && svc) {
    await fetch(`https://api.render.com/v1/services/${svc}/deploys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
  }
}

type AgentRecord = {
  id: string;
  name: string;
  title: string;
  scope: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  languages?: string[];
  photo?: string;
  token: string;
  public?: boolean;
  match: string[];
};

export async function POST(req: NextRequest) {
  if (
    process.env.ADMIN_PASSWORD &&
    !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    agent?: Partial<AgentRecord>;
    photo?: { data: string; ext?: string } | null;
    isNew?: boolean;
    originalId?: string;
    deleteAgent?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { agent = {}, photo, isNew = false, originalId, deleteAgent = false } = body;

  let list: AgentRecord[];
  try {
    list = await getRepoJson<AgentRecord[]>('content/agents.json');
  } catch (e) {
    return NextResponse.json(
      { error: 'Could not read agents.json from GitHub. Is GITHUB_TOKEN/GITHUB_REPO set?', detail: String(e) },
      { status: 500 },
    );
  }

  // ----- Delete -----
  if (deleteAgent && originalId) {
    const existing = list.find((a) => a.id === originalId);
    const next = list.filter((a) => a.id !== originalId);
    const deletePaths = existing?.photo ? [`public/agents/${existing.photo}`] : [];
    const { commitSha } = await commitFiles({
      message: `admin: delete agent ${originalId}`,
      textFiles: [{ path: 'content/agents.json', content: JSON.stringify(next, null, 2) + '\n' }],
      deletePaths,
    });
    await triggerRedeploy();
    return NextResponse.json({ ok: true, commitSha, deleted: originalId });
  }

  // ----- Validate -----
  const id = (agent.id || '').trim();
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id (lowercase letters, numbers, hyphens).' }, { status: 400 });
  }
  if (isNew && list.some((a) => a.id === id)) {
    return NextResponse.json({ error: `An agent with id "${id}" already exists.` }, { status: 409 });
  }
  if (!agent.email || !/.+@.+\..+/.test(agent.email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const previous = !isNew ? list.find((a) => a.id === (originalId || id)) : undefined;

  // ----- Photo upload -----
  const binaryFiles: { path: string; base64: string }[] = [];
  let photoName = previous?.photo || '';
  if (photo && photo.data) {
    const ext = (photo.ext || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    photoName = `${id}.${ext}`;
    const base64 = photo.data.includes(',') ? photo.data.split(',')[1] : photo.data;
    binaryFiles.push({ path: `public/agents/${photoName}`, base64 });
  }

  const record: AgentRecord = {
    id,
    name: (agent.name || previous?.name || '').trim(),
    title: (agent.title || previous?.title || '').trim(),
    scope: (agent.scope || previous?.scope || '').trim(),
    email: agent.email.trim(),
    phone: (agent.phone || '').trim(),
    whatsapp: (agent.whatsapp || '').replace(/[^0-9]/g, ''),
    languages: (agent.languages || []).map((s) => s.trim()).filter(Boolean),
    photo: photoName,
    token: previous?.token || agent.token || `ag_${randomBytes(8).toString('hex')}`,
    public: agent.public !== false,
    match: (agent.match || previous?.match || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
  };

  const next = isNew
    ? [...list, record]
    : list.map((a) => (a.id === (originalId || id) ? record : a));

  try {
    const { commitSha } = await commitFiles({
      message: `admin: ${isNew ? 'add' : 'update'} agent ${id}`,
      textFiles: [{ path: 'content/agents.json', content: JSON.stringify(next, null, 2) + '\n' }],
      binaryFiles,
    });
    await triggerRedeploy();
    return NextResponse.json({ ok: true, commitSha, id, token: record.token });
  } catch (e) {
    return NextResponse.json({ error: 'Commit failed', detail: String(e) }, { status: 500 });
  }
}
