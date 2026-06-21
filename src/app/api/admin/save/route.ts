import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { commitFiles } from '@/lib/github';
import { getCars, saveCars, putMedia } from '@/lib/store';
import type { Car } from '@/data/cars';

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
  sellable?: boolean;
  minPrice?: number;
  currency?: string;
  location?: string;
  specs?: Record<string, string>;
  sold?: boolean;
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

  // clip: undefined = keep as-is, null = remove, {url} = external link, {data} = uploaded file
  type VideoEntry = { url?: string; data?: string; ext?: string } | null;

  let body: {
    car?: Partial<CarRecord>;
    images?: ImageEntry[];
    clip?: VideoEntry;
    isNew?: boolean;
    originalSlug?: string;
    deleteCar?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { car = {}, isNew = false, originalSlug, deleteCar = false } = body;
  // images omitted entirely (partial update) → keep the car's existing images.
  const providedImages = body.images;

  let list: CarRecord[];
  try {
    list = (await getCars()) as unknown as CarRecord[];
  } catch (e) {
    return NextResponse.json({ error: 'Could not read cars from the database.', detail: String(e) }, { status: 500 });
  }

  // ----- Delete a car -----
  if (deleteCar && originalSlug) {
    const existing = list.find((c) => c.slug === originalSlug);
    const next = list.filter((c) => c.slug !== originalSlug);
    await saveCars(next as unknown as Car[]);
    // Remove the car's image files from the repo (best-effort).
    const deletePaths = (existing?.images || [])
      .filter((n) => !/^https?:\/\//.test(n))
      .map((n) => `public/cars/${originalSlug}/${n}`);
    if (deletePaths.length) {
      await commitFiles({ message: `admin: delete ${originalSlug} images`, deletePaths }).catch(() => {});
    }
    return NextResponse.json({ ok: true, deleted: originalSlug });
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

  // ----- Resolve final image list. New uploads go to the DB (instant, no
  // redeploy); existing entries are kept as-is. If `images` is omitted entirely
  // (a partial update), the car keeps its current images. -----
  let finalImages: string[];
  if (providedImages === undefined && previous) {
    finalImages = [...previous.images];
  } else {
    finalImages = [];
    for (const entry of providedImages || []) {
      if (entry.type === 'existing') {
        finalImages.push(entry.name);
      } else if (entry.type === 'new' && entry.data) {
        const base64 = entry.data.includes(',') ? entry.data.split(',')[1] : entry.data;
        const id = await putMedia('image/jpeg', Buffer.from(base64, 'base64'));
        finalImages.push(`/api/media/${id}`);
      }
    }
  }
  if (finalImages.length === 0) {
    return NextResponse.json({ error: 'A car needs at least one image.' }, { status: 400 });
  }

  // Git is now only touched for video clips; image add/remove never redeploys.
  const binaryFiles: { path: string; base64: string }[] = [];
  const deletePaths: string[] = [];

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
  // Specs + location belong to the car — keep previous values when not provided
  // (so a partial update never wipes them).
  const loc = car.location !== undefined ? String(car.location).trim() : previous?.location || '';
  if (loc) record.location = loc;
  const specs = car.specs !== undefined ? cleanSpecs(car.specs) : previous?.specs;
  if (specs) record.specs = specs;

  // Public availability: honor an explicit `sold` flag; otherwise keep previous.
  if ('sold' in car) {
    if (car.sold) record.sold = true;
  } else if (previous?.sold) {
    record.sold = true;
  }

  // Selling fields: honor an explicit `sellable` in the payload; otherwise keep
  // whatever the car already had.
  if ('sellable' in car) {
    if (car.sellable) {
      record.sellable = true;
      if (typeof car.minPrice === 'number' && car.minPrice > 0) record.minPrice = car.minPrice;
      record.currency = (car.currency as string) || 'EUR';
    }
  } else if (previous?.sellable) {
    record.sellable = true;
    if (typeof previous.minPrice === 'number') record.minPrice = previous.minPrice;
    if (previous.currency) record.currency = previous.currency;
  }
  // ----- Resolve the vertical clip (upload / URL / remove / keep) -----
  const clipInput = body.clip;
  const wasLocalClip = !!previous?.clip && previous.clip.startsWith('/cars/');
  if (clipInput === undefined) {
    if (previous?.clip) record.clip = previous.clip; // keep
  } else if (clipInput === null) {
    if (wasLocalClip) deletePaths.push(`public${previous!.clip}`); // remove
  } else if (clipInput.url && clipInput.url.trim()) {
    record.clip = clipInput.url.trim();
    if (wasLocalClip && previous!.clip !== record.clip) deletePaths.push(`public${previous!.clip}`);
  } else if (clipInput.data) {
    const ext = (clipInput.ext || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
    const name = `clip-${Date.now().toString(36)}.${ext}`;
    const base64 = clipInput.data.includes(',') ? clipInput.data.split(',')[1] : clipInput.data;
    binaryFiles.push({ path: `public/cars/${slug}/${name}`, base64 });
    record.clip = `/cars/${slug}/${name}`;
    if (wasLocalClip) deletePaths.push(`public${previous!.clip}`);
  } else if (previous?.clip) {
    record.clip = previous.clip;
  }

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
    // Car data → database (instant, no redeploy).
    await saveCars(next as unknown as Car[]);

    // Image files still live in the repo, so commit any new/removed images and
    // trigger one redeploy only when images actually changed.
    let imagesChanged = false;
    if (binaryFiles.length || deletePaths.length) {
      await commitFiles({
        message: `admin: ${isNew ? 'add' : 'update'} ${slug} images`,
        binaryFiles,
        deletePaths,
      });
      await triggerRedeploy();
      imagesChanged = true;
    }
    return NextResponse.json({ ok: true, slug, imagesChanged });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed', detail: String(e) }, { status: 500 });
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
