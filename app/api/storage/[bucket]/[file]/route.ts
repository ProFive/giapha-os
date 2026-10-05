import { getFileStream } from '@/utils/r2/storage'
import { getUser } from '@/utils/db/queries'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

interface RouteContext {
  params: Promise<{ bucket: string; file: string }>
}

const ALLOWED_BUCKETS = new Set(['gallery', 'news', 'avatars'])

export async function GET(_req: Request, { params }: RouteContext) {
  const { bucket, file } = await params

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const fileName = decodeURIComponent(file)
  if (!fileName || fileName.includes('..') || fileName.length > 512) {
    return new NextResponse('Invalid file', { status: 400 })
  }

  // For avatars and private content, require authentication
  const user = await getUser()
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const obj = await getFileStream(
    bucket as 'gallery' | 'news' | 'avatars',
    fileName
  )
  if (!obj) return new NextResponse('Not found', { status: 404 })

  const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream'
  if (!contentType.startsWith('image/')) {
    return new NextResponse('Unsupported media type', { status: 415 })
  }

  return new NextResponse(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
