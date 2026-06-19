import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { commitFiles, getRepoJson } from '@/lib/github';

export const runtime = 'nodejs';

// Trigger a Render deploy so the committed change goes live (no GitHub webhook needed).
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

type Localized = { en: string; tr?: string };
type LocalizedList = { en: string[]; tr?: string[] };
type CarRecord = {
  slug: string;
  year: number;
  make: string;
  model: string;
  category: string;
  featured?: boolean;
  images: string[];
  tagline: Localized;
  description: Localized;
  inspection: LocalizedList;
  clip?: string;
  film?: string;
  filmPoster?: string;
  forSale?: boolean;
  price?: string;
  status?: string;
  location?: string;
  specs?: Record<string, string>;
};

type ImageEntry =
  | { type: 'existing'; name: string }
  | { type: 'new'; data: string; ext?: string };

export async function POST(req: NextRequest) {
  // Enforce auth only when a password is configured (open otherwise).
  if (
    process.env.ADMIN_PASSWORD &&
    !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    car?: Partial<CarRecord>;
    images?: ImageEntry[];
    isNew?: boolean;
    originalSlug?: string;
    deleteCar?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { car = {}, images = [], isNew = false, originalSlug, deleteCar = false } = body;

  let list: CarRecord[];
  try {
    list = await getRepoJson<CarRecord[]>('content/cars.json');
  } catch (e) {
    return NextResponse.json(
      { error: 'Could not read cars.json from GitHub. Is GITHUB_TOKEN/GITHUB_REPO set?', detail: String(e) },
      { status: 500 },
    );
  }

  // ----- Delete a car -----
  if (deleteCar && originalSlug) {
    const existing = list.find((c) => c.slug === originalSlug);
    const deletePaths = (existing?.images || []).map((n) => `public/cars/${originalSlug}/${n}`);
    const next = list.filter((c) => c.slug !== originalSlug);
    const { commitSha } = await commitFiles({
      message: `admin: delete ${originalSlug}`,
      textFiles: [{ path: 'content/cars.json', content: JSON.stringify(next, null, 2) + '\n' }],
      deletePaths,
    });
    await triggerRedeploy();
    return NextResponse.json({ ok: true, commitSha, deleted: originalSlug });
  }

  // ----- Validate slug -----
  const slug = (car.slug || '').trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug (use lowercase letters, numbers, hyphens).' }, { status: 400 });
  }
  if (isNew && list.some((c) => c.slug === slug)) {
    return NextResponse.json({ error: `A car with slug "${slug}" already exists.` }, { status: 409 });
  }

  const previous = !isNew ? list.find((c) => c.slug === (originalSlug || slug)) : undefined;

  // ----- Resolve final image list + new uploads + deletions -----
  const binaryFiles: { path: string; base64: string }[] = [];
  const finalImages: string[] = [];
  let counter = Date.now();
  for (const entry of images) {
    if (entry.type === 'existing') {
      finalImages.push(entry.name);
    } else if (entry.type === 'new' && entry.data) {
      const ext = (entry.ext || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const name = `u${(counter++).toString(36)}.${ext}`;
      const base64 = entry.data.includes(',') ? entry.data.split(',')[1] : entry.data;
      binaryFiles.push({ path: `public/cars/${slug}/${name}`, base64 });
      finalImages.push(name);
    }
  }
  if (finalImages.length === 0) {
    return NextResponse.json({ error: 'A car needs at least one image.' }, { status: 400 });
  }

  // Files removed from an existing car
  const deletePaths: string[] = [];
  if (previous) {
    for (const oldName of previous.images) {
      if (!finalImages.includes(oldName)) {
        deletePaths.push(`public/cars/${previous.slug}/${oldName}`);
      }
    }
  }

  // ----- Build the updated record (preserve video fields unless cleared) -----
  const record: CarRecord = {
    slug,
    year: Number(car.year) || previous?.year || new Date().getFullYear(),
    make: (car.make || previous?.make || '').trim(),
    model: (car.model || previous?.model || '').trim(),
    category: (car.category as string) || previous?.category || 'collector',
    featured: !!car.featured,
    images: finalImages,
    tagline: normLoc(car.tagline, previous?.tagline),
    description: normLoc(car.description, previous?.description),
    inspection: normList(car.inspection, previous?.inspection),
  };
  if (car.forSale) {
    record.forSale = true;
    record.price = (car.price || '').trim();
    record.status = (car.status as string) || 'available';
    const loc = (car.location || '').trim();
    if (loc) record.location = loc;
    const specs = cleanSpecs(car.specs);
    if (specs) record.specs = specs;
  }
  if (previous?.clip) record.clip = previous.clip;
  if (previous?.film) record.film = previous.film;
  if (previous?.filmPoster) record.filmPoster = previous.filmPoster;

  // ----- Place in list -----
  let next: CarRecord[];
  if (isNew) {
    next = [...list, record];
  } else {
    next = list.map((c) => (c.slug === (originalSlug || slug) ? record : c));
  }

  try {
    const { commitSha } = await commitFiles({
      message: `admin: ${isNew ? 'add' : 'update'} ${slug}`,
      textFiles: [{ path: 'content/cars.json', content: JSON.stringify(next, null, 2) + '\n' }],
      binaryFiles,
      deletePaths,
    });
    await triggerRedeploy();
    return NextResponse.json({ ok: true, commitSha, slug });
  } catch (e) {
    return NextResponse.json({ error: 'Commit failed', detail: String(e) }, { status: 500 });
  }
}

function normLoc(v: Localized | undefined, prev?: Localized): Localized {
  return { en: (v?.en ?? prev?.en ?? '').trim(), tr: (v?.tr ?? prev?.tr ?? '').trim() };
}
// Keep only non-empty spec values; return undefined if the sheet is empty.
function cleanSpecs(v: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!v) return undefined;
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(v)) {
    const val = (raw || '').trim();
    if (val) out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

function normList(v: LocalizedList | undefined, prev?: LocalizedList): LocalizedList {
  const clean = (arr?: string[]) => (arr || []).map((s) => s.trim()).filter(Boolean);
  return {
    en: clean(v?.en ?? prev?.en),
    tr: clean(v?.tr ?? prev?.tr),
  };
}
