import { Profile } from '@/types'
import { getUserBySessionToken, SESSION_COOKIE } from '@/utils/db/auth'
import { getSql } from '@/utils/db/client'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Cached per request so a page and its layout share one session lookup.
export const getUser = cache(async () => {
  const cookieStore = await cookies()
  return getUserBySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
})

export const getProfile = cache(async (userId?: string) => {
  let id = userId
  if (!id) {
    const user = await getUser()
    if (!user) return null
    id = user.id
  }

  const [profile] = await getSql()<Profile[]>`
    SELECT id, role, is_active, person_id, created_at, updated_at
    FROM public.profiles
    WHERE id = ${id}
  `

  if (!profile) {
    console.error(`Cannot load profile for user ${id}`)
  }

  return profile ?? null
})

export const getIsAdmin = cache(async () => {
  const profile = await getProfile()
  return profile?.role === 'admin' && profile.is_active
})

/** The current profile if the account has been approved, otherwise null. */
export async function getActiveProfile() {
  const profile = await getProfile()
  return profile?.is_active ? profile : null
}

/** The current profile if it may edit family data (admin or editor). */
export async function getEditorProfile() {
  const profile = await getActiveProfile()
  return profile && (profile.role === 'admin' || profile.role === 'editor')
    ? profile
    : null
}

/** The current profile if it is an active administrator. */
export async function getAdminProfile() {
  const profile = await getActiveProfile()
  return profile?.role === 'admin' ? profile : null
}
