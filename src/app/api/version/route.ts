import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, unauthenticated build marker. Render injects RENDER_GIT_COMMIT at
// build/run time, so curling this endpoint tells us exactly which commit is
// live — used to confirm a deploy has rolled out.
export function GET() {
  return NextResponse.json({
    commit: process.env.RENDER_GIT_COMMIT || 'unknown',
    builtFrom: process.env.RENDER_GIT_BRANCH || 'unknown',
  });
}
