import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { getAgents, saveAgents, putMedia } from '@/lib/store';
import { sendEmail, welcomeEmail } from '@/lib/email';
import type { Agent } from '@/data/agents';

export const runtime = 'nodejs';

function baseUrl(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return host ? `https://${host}` : req.nextUrl.origin;
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
    list = (await getAgents()) as unknown as AgentRecord[];
  } catch (e) {
    return NextResponse.json({ error: 'Could not read agents from the database.', detail: String(e) }, { status: 500 });
  }

  // ----- Delete -----
  if (deleteAgent && originalId) {
    const existing = list.find((a) => a.id === originalId);
    void existing;
    const next = list.filter((a) => a.id !== originalId);
    await saveAgents(next as unknown as Agent[]);
    return NextResponse.json({ ok: true, deleted: originalId });
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

  // ----- Photo upload → DB (instant, no redeploy) -----
  let photoName = previous?.photo || '';
  if (photo && photo.data) {
    const base64 = photo.data.includes(',') ? photo.data.split(',')[1] : photo.data;
    const mediaId = await putMedia('image/jpeg', Buffer.from(base64, 'base64'));
    photoName = `/api/media/${mediaId}`;
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
    // Everything (incl. photo) is in the DB now — instant, no redeploy.
    await saveAgents(next as unknown as Agent[]);

    // Welcome a brand-new agent with their private dashboard link.
    let welcomed: boolean | undefined;
    if (isNew && record.email) {
      const dashUrl = `${baseUrl(req)}/agent/${record.token}`;
      const tpl = welcomeEmail(record as Agent, dashUrl);
      const r = await sendEmail({ to: record.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      welcomed = r.ok;
    }
    return NextResponse.json({ ok: true, id, token: record.token, welcomed });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed', detail: String(e) }, { status: 500 });
  }
}
