import { NextRequest, NextResponse } from 'next/server';
import { getMedia } from '@/lib/store';

export const runtime = 'nodejs';

// Serve an image stored in the DB. Media ids are unique per upload, so responses
// are immutable and cache hard at the CDN/browser.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await getMedia(id.replace(/\.[a-z0-9]+$/i, '')); // tolerate an optional extension
  if (!media) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      'Content-Type': media.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
