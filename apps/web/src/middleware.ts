import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'gfs_rt';
const PUBLIC = ['/login'];

/**
 * Edge gate: no refresh cookie → no session → send to /login before rendering anything.
 * (Token validity is still enforced by the API; this only avoids flashing private UI.)
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(REFRESH_COOKIE);
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.svg|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
