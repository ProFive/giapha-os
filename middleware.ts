import { getRequestContext } from '@cloudflare/next-on-pages'
import { isPublicDashboardPath } from '@/lib/publicRoutes'
import { SESSION_COOKIE } from '@/utils/db/auth'
import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

interface Env {
  DB: D1Database
}

export async function middleware(request: NextRequest) {
  const { env } = getRequestContext()
  const db = (env as unknown as Env).DB

  if (!db) {
    // DB not configured – redirect to setup
    if (request.nextUrl.pathname !== '/setup') {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  // Pass pathname through a header so layouts can determine route type
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  let userId: string | null = null

  if (sessionId) {
    try {
      const row = await db
        .prepare(
          `SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')`
        )
        .bind(sessionId)
        .first<{ user_id: string }>()
      userId = row?.user_id ?? null
    } catch {
      userId = null
    }
  }

  const pathname = request.nextUrl.pathname
  const isProtectedPath = pathname.startsWith('/dashboard')
  const isPublicPath = isPublicDashboardPath(pathname)
  const isLoginPage = pathname.startsWith('/login')

  // Check DB schema is set up (look for users table)
  if (isProtectedPath || isLoginPage) {
    try {
      await db.prepare('SELECT 1 FROM users LIMIT 1').first()
    } catch {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
  }

  if (isProtectedPath && !userId && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isLoginPage && userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
