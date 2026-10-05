import { cache } from 'react'
import { cookies } from 'next/headers'
import { getDB } from './client'
import { SESSION_COOKIE } from './auth'
import type { Profile } from '@/types'

export interface AuthUser {
  id: string
  email: string
  created_at: string
}

/**
 * Returns the currently authenticated user based on the session cookie.
 * Cached per request so multiple calls don't hit the DB twice.
 */
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const db = getDB()
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .bind(token)
    .first<AuthUser>()

  return row ?? null
})

/**
 * Returns the profile for the current user (or a specific userId).
 */
export const getProfile = cache(
  async (userId?: string): Promise<Profile | null> => {
    let id = userId
    if (!id) {
      const user = await getUser()
      if (!user) return null
      id = user.id
    }
    const db = getDB()
    const row = await db
      .prepare('SELECT * FROM profiles WHERE id = ?')
      .bind(id)
      .first<Profile>()

    return row ?? null
  }
)

/**
 * Returns true if the current user is an active admin.
 */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  const profile = await getProfile()
  return profile?.role === 'admin' && Boolean(profile.is_active)
})
