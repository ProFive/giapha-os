import { NextResponse } from 'next/server'

// Redirect old avatar URLs to new storage route
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(
    new URL(`/api/storage/avatars/${encodeURIComponent(path)}`, request.url)
  )
}
