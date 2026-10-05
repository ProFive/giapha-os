import {
  BUCKETS,
  IMAGE_CONTENT_TYPES,
  isBucket,
  isSafeObjectPath
} from '@/utils/blob/buckets'
import { getActiveProfile } from '@/utils/db/queries'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const [bucket, ...segments] = pathname.split('/')
        const path = segments.join('/')

        if (!isBucket(bucket) || !isSafeObjectPath(path)) {
          throw new Error('Invalid upload path')
        }

        const profile = await getActiveProfile()
        const writer = BUCKETS[bucket].writer
        const allowed =
          profile &&
          (profile.role === 'admin' ||
            (writer === 'editor' && profile.role === 'editor'))

        if (!allowed) throw new Error('Forbidden')

        return {
          allowedContentTypes: IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: BUCKETS[bucket].maxBytes,
          addRandomSuffix: false,
          // Avatars are named after the person, so a new photo replaces the old.
          allowOverwrite: bucket === 'avatars'
        }
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    )
  }
}
