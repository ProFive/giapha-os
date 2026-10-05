/**
 * Folders inside the private Vercel Blob store. Each one mirrors a former
 * Supabase Storage bucket: same size limit, same image types, same writers.
 * Every approved (active) user may read every bucket.
 */
export const BUCKETS = {
  avatars: { maxBytes: 2 * 1024 * 1024, writer: 'editor' },
  gallery: { maxBytes: 10 * 1024 * 1024, writer: 'admin' },
  news: { maxBytes: 10 * 1024 * 1024, writer: 'editor' }
} as const

export type Bucket = keyof typeof BUCKETS

export const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]

export function isBucket(value: string): value is Bucket {
  return Object.hasOwn(BUCKETS, value)
}

/** A path inside a bucket must be relative and must not climb out of it. */
export function isSafeObjectPath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 512 &&
    !path.startsWith('/') &&
    !path.split('/').includes('..')
  )
}

/** Same-origin URL that streams a private file after checking the session. */
export function getFileUrl(bucket: Bucket, path: string) {
  return `/api/files/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
}
