import { getStorage } from '@/utils/db/client'

export type StorageBucket = 'gallery' | 'news' | 'avatars'

function bucketKey(bucket: StorageBucket, fileName: string): string {
  return `${bucket}/${fileName}`
}

export async function uploadFile(
  bucket: StorageBucket,
  fileName: string,
  data: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<{ key: string; error: Error | null }> {
  try {
    const storage = getStorage()
    const key = bucketKey(bucket, fileName)
    await storage.put(key, data, {
      httpMetadata: { contentType }
    })
    return { key, error: null }
  } catch (error) {
    console.error('R2 upload error:', error)
    return { key: '', error: error as Error }
  }
}

export async function deleteFile(
  bucket: StorageBucket,
  fileName: string
): Promise<{ error: Error | null }> {
  try {
    const storage = getStorage()
    await storage.delete(bucketKey(bucket, fileName))
    return { error: null }
  } catch (error) {
    console.error('R2 delete error:', error)
    return { error: error as Error }
  }
}

export async function getFileStream(
  bucket: StorageBucket,
  fileName: string
): Promise<R2ObjectBody | null> {
  const storage = getStorage()
  const obj = await storage.get(bucketKey(bucket, fileName))
  return obj
}

/**
 * Normalise a stored image value to an R2 file name.
 * Accepts either a bare file name ("abc.jpg") or a full path ("gallery/abc.jpg").
 */
export function parseStorageFileName(
  bucket: StorageBucket,
  value: string | null | undefined
): string | null {
  if (!value) return null
  const prefix = `${bucket}/`
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

/** Public URL path used to serve R2 objects via our API proxy. */
export function r2PublicUrl(bucket: StorageBucket, fileName: string): string {
  return `/api/storage/${bucket}/${encodeURIComponent(fileName)}`
}
