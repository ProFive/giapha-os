import { getCloudflareContext } from '@opennextjs/cloudflare'

export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
}

/**
 * Returns the D1 database binding.
 * Must only be called in edge runtime (Server Components, Server Actions, API Routes).
 */
export function getDB(): D1Database {
  const { env } = getCloudflareContext()
  return (env as unknown as Env).DB
}

/**
 * Returns the R2 storage bucket binding.
 */
export function getStorage(): R2Bucket {
  const { env } = getCloudflareContext()
  return (env as unknown as Env).STORAGE
}
