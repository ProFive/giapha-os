import { isBucket, isSafeObjectPath } from '@/utils/blob/buckets'
import { getActiveProfile } from '@/utils/db/queries'
import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function safeDecode(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

interface RouteContext {
  params: Promise<{ bucket: string; path: string[] }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { bucket, path: segments } = await params
  const path = segments.map(safeDecode).join('/')

  if (!isBucket(bucket) || !isSafeObjectPath(path)) {
    return new NextResponse('Invalid file path', { status: 400 })
  }

  // Files stay private: only approved accounts may read them.
  const profile = await getActiveProfile()
  if (!profile) return new NextResponse('Forbidden', { status: 403 })

  const result = await get(`${bucket}/${path}`, { access: 'private' })

  if (!result || result.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (!result.blob.contentType.startsWith('image/')) {
    return new NextResponse('Unsupported file type', { status: 415 })
  }

  return new NextResponse(result.stream, {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Type': result.blob.contentType,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
