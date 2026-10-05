import { Bucket } from '@/utils/blob/buckets'
import { del } from '@vercel/blob'

/** Remove files from a bucket. Missing files are ignored by Vercel Blob. */
export async function deleteFiles(bucket: Bucket, paths: string[]) {
  const pathnames = paths.filter(Boolean).map((path) => `${bucket}/${path}`)
  if (pathnames.length === 0) return
  await del(pathnames)
}
