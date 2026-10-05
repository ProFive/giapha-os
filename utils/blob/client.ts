import { Bucket } from '@/utils/blob/buckets'
import { upload } from '@vercel/blob/client'

/**
 * Upload a file straight from the browser to Vercel Blob. /api/upload checks
 * the session and role before handing out a one-time upload token, so large
 * images never pass through the 4.5 MB serverless request limit.
 */
export async function uploadFile(bucket: Bucket, path: string, file: File) {
  await upload(`${bucket}/${path}`, file, {
    access: 'private',
    contentType: file.type,
    handleUploadUrl: '/api/upload'
  })
  return path
}

/** Unique file name that keeps the original extension. */
export function createFileName(file: File) {
  const fileExt = file.name.split('.').pop()
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
}
