import { NextResponse } from 'next/server'

// OAuth callback is no longer used - redirecting to login
export async function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.redirect(new URL('/login', url.origin))
}
