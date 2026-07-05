import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const docToken = request.cookies.get('docToken')?.value
  const adminToken = request.cookies.get('adminToken')?.value

  const isAuthenticated = token || docToken || adminToken

  const publicRoutes = ['/', '/about', '/contact', '/login', '/signup', '/forgot-password']
  
  // Also consider API routes or public assets as public
  if (
    publicRoutes.includes(request.nextUrl.pathname) || 
    request.nextUrl.pathname.startsWith('/api') || 
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/assets') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // If trying to access protected routes without being authenticated
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|assets).*)'],
}
