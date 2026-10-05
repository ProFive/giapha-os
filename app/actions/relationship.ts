'use server'

import { getServerTranslations } from '@/lib/i18n/server'
import { getProfile } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { generateId } from '@/utils/db/auth'
import { revalidatePath } from 'next/cache'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function assertCanEdit() {
  const { t } = await getServerTranslations()
  const profile = await getProfile()
  if (
    !profile?.is_active ||
    (profile.role !== 'admin' && profile.role !== 'editor')
  ) {
    return { error: t('memberDeleteAccessDenied') }
  }
  return null
}

export async function addRelationship(input: {
  type: string
  person_a: string
  person_b: string
  note?: string | null
}) {
  const denied = await assertCanEdit()
  if (denied) return denied

  if (
    !['marriage', 'biological_child', 'adopted_child'].includes(input.type) ||
    !UUID_PATTERN.test(input.person_a) ||
    !UUID_PATTERN.test(input.person_b) ||
    input.person_a === input.person_b
  ) {
    return { error: 'Invalid relationship data' }
  }

  const db = getDB()
  const id = generateId()
  const now = new Date().toISOString()

  try {
    await db
      .prepare(
        'INSERT INTO relationships (id, type, person_a, person_b, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
      )
      .bind(id, input.type, input.person_a, input.person_b, input.note ?? null, now, now)
      .run()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (msg.includes('UNIQUE')) return { error: 'Relationship already exists' }
    return { error: msg }
  }

  revalidatePath('/dashboard/members')
  return { success: true, id }
}

export async function deleteRelationship(id: string) {
  const denied = await assertCanEdit()
  if (denied) return denied

  if (!UUID_PATTERN.test(id)) return { error: 'Invalid ID' }

  const db = getDB()
  await db.prepare('DELETE FROM relationships WHERE id = ?').bind(id).run()

  revalidatePath('/dashboard/members')
  return { success: true }
}

export async function getPersonRelationships(personId: string) {
  if (!UUID_PATTERN.test(personId)) return { data: null, error: 'Invalid ID' }

  const db = getDB()
  const res = await db
    .prepare(
      'SELECT * FROM relationships WHERE person_a = ? OR person_b = ?'
    )
    .bind(personId, personId)
    .all()

  return { data: res.results ?? [], error: null }
}
