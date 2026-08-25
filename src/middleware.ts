import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Route protection by role.
 *
 * This previously treated the three session cookies as interchangeable — any one of them
 * satisfied every protected route — so a signed-in patient could open the admin pages
 * simply by navigating to them. Each area now demands its own cookie.
 *
 * Note what this does and does not do. Middleware only decides which *pages* get served;
 * it cannot be the only defence, because server actions are POST endpoints that bypass
 * page routing entirely. The real authorization lives in the actions themselves
 * (`requireAdmin` in adminActions, `getSessionId` elsewhere). This is the outer layer:
 * it stops the wrong person seeing the wrong screen.
 *
 * The cookie is checked for presence only — verifying its signature needs the `jsonwebtoken`
 * library, which does not run on the Edge runtime middleware uses. A forged cookie
 * therefore gets past this check and is then rejected by the server action behind it,
 * which does verify properly.
 */

const PUBLIC_ROUTES = ['/', '/about', '/contact', '/login', '/signup', '/forgot-password']

const USER_COOKIE = 'token'
const DOCTOR_COOKIE = 'docToken'
const ADMIN_COOKIE = 'adminToken'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public pages, framework internals and static assets are always allowed through.
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(USER_COOKIE)?.value
  const docToken = request.cookies.get(DOCTOR_COOKIE)?.value
  const adminToken = request.cookies.get(ADMIN_COOKIE)?.value

  // ─── Admin area ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    // The admin login page must stay reachable while signed out, or there is no way in.
    if (pathname === '/admin/login') return NextResponse.next()
    if (!adminToken) return NextResponse.redirect(new URL('/admin/login', request.url))
    return NextResponse.next()
  }

  // ─── Doctor area ─────────────────────────────────────────────────────────
  if (pathname.startsWith('/doctor-dashboard')) {
    if (pathname === '/doctor-dashboard/login') return NextResponse.next()
    if (!docToken) return NextResponse.redirect(new URL('/doctor-dashboard/login', request.url))
    return NextResponse.next()
  }

  // ─── Everything else: any signed-in role ─────────────────────────────────
  // Patient pages (appointments, profile, video call) are reachable by a doctor too —
  // a doctor joining a consultation is legitimate, and the actions behind these pages
  // enforce who may actually read what.
  if (!token && !docToken && !adminToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
}
