'use server'

import config from '@/app/config'
import { getServerTranslations } from '@/lib/i18n/server'
import { UserRole } from '@/types'
import { getUser, getIsAdmin } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { hashPassword, verifyPassword, generateId } from '@/utils/db/auth'
import { revalidatePath } from 'next/cache'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function changeUserRole(userId: string, newRole: UserRole) {
  const { t } = await getServerTranslations()
  if (!await getIsAdmin()) return { error: t('dataAccessDenied') }
  if (!UUID_PATTERN.test(userId)) return { error: 'Invalid user ID' }

  const db = getDB()
  const now = new Date().toISOString()
  await db
    .prepare('UPDATE profiles SET role = ?, updated_at = ? WHERE id = ?')
    .bind(newRole, now, userId)
    .run()

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function setUserPerson(userId: string, personId: string | null) {
  if (!await getIsAdmin()) return { error: 'Access denied' }
  if (!UUID_PATTERN.test(userId)) return { error: 'Invalid user ID' }

  const db = getDB()
  const now = new Date().toISOString()

  if (personId !== null) {
    const person = await db
      .prepare('SELECT id FROM persons WHERE id = ?')
      .bind(personId)
      .first()
    if (!person) return { error: 'Person not found' }

    const existing = await db
      .prepare('SELECT id FROM profiles WHERE person_id = ? AND id != ?')
      .bind(personId, userId)
      .first()
    if (existing) return { error: 'Person already linked to another account' }
  }

  await db
    .prepare('UPDATE profiles SET person_id = ?, updated_at = ? WHERE id = ?')
    .bind(personId, now, userId)
    .run()

  revalidatePath('/dashboard/users')
}

export async function deleteUser(userId: string) {
  const { t } = await getServerTranslations()
  if (!await getIsAdmin()) return { error: t('dataAccessDenied') }
  if (!UUID_PATTERN.test(userId)) return { error: 'Invalid user ID' }

  const currentUser = await getUser()
  if (currentUser?.id === userId) return { error: 'Cannot delete your own account' }

  const db = getDB()
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function adminCreateUser(formData: FormData) {
  const { t } = await getServerTranslations()
  if (!await getIsAdmin()) return { error: t('dataAccessDenied') }

  const email = formData.get('email')?.toString()
  const password = formData.get('password')?.toString()
  const role = formData.get('role')?.toString() || 'member'
  const isActiveStr = formData.get('is_active')?.toString()
  const isActive = isActiveStr === 'false' ? 0 : 1

  if (role !== 'admin' && role !== 'editor' && role !== 'member') {
    return { error: t('invalidUserRole') }
  }
  if (!email || !password) return { error: t('emailPasswordRequired') }

  const db = getDB()
  const existing = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first()
  if (existing) return { error: 'Email already registered' }

  const userId = generateId()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  await db.batch([
    db.prepare(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)'
    ).bind(userId, email.toLowerCase(), passwordHash, now, now),
    db.prepare(
      'INSERT INTO profiles (id, role, is_active, created_at, updated_at) VALUES (?,?,?,?,?)'
    ).bind(userId, role, isActive, now, now)
  ])

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function resetUserPassword(userId: string) {
  const { t } = await getServerTranslations()
  if (!await getIsAdmin()) return { error: t('dataAccessDenied') }
  if (!UUID_PATTERN.test(userId)) return { error: 'Invalid user ID' }

  const db = getDB()
  const newHash = await hashPassword(config.defaultResetPassword)
  const now = new Date().toISOString()

  await db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, now, userId)
    .run()

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const db = getDB()
  const row = await db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ password_hash: string }>()

  if (!row) return { error: 'User not found' }

  const valid = await verifyPassword(currentPassword, row.password_hash)
  if (!valid) return { error: 'Current password is incorrect' }

  const newHash = await hashPassword(newPassword)
  const now = new Date().toISOString()
  await db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, now, user.id)
    .run()

  return { success: true }
}

export async function toggleUserStatus(userId: string, newStatus: boolean) {
  const { t } = await getServerTranslations()
  if (!await getIsAdmin()) return { error: t('dataAccessDenied') }
  if (!UUID_PATTERN.test(userId)) return { error: 'Invalid user ID' }

  const db = getDB()
  const now = new Date().toISOString()
  await db
    .prepare('UPDATE profiles SET is_active = ?, updated_at = ? WHERE id = ?')
    .bind(newStatus ? 1 : 0, now, userId)
    .run()

  revalidatePath('/dashboard/users')
  return { success: true }
}
