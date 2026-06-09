import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { ADMIN_COOKIE, verifySessionToken } from './lib/admin-auth';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin area: not localized. Auth is enforced ONLY when ADMIN_PASSWORD is set;
  // with no password configured the panel is open to anyone (re-lock by setting it).
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();
    if (process.env.ADMIN_PASSWORD) {
      const ok = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
      if (!ok) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/login';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Everything else goes through next-intl locale routing.
  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
