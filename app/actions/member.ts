'use server'

import { getServerTranslations } from '@/lib/i18n/server'
import { getProfile } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function deleteMemberProfile(memberId: string) {
  const { t } = await getServerTranslations()
  if (!UUID_PATTERN.test(memberId)) {
    return { error: t('invalidProfile') }
  }

  const profile = await getProfile()
  const db = getDB()

  if (
    !profile?.is_active ||
    (profile.role !== 'admin' && profile.role !== 'editor')
  ) {
    return {
      error: t('memberDeleteAccessDenied')
    }
  }

  // 2. Check for existing relationships
  const rel = await db
    .prepare(
      'SELECT id FROM relationships WHERE person_a = ? OR person_b = ? LIMIT 1'
    )
    .bind(memberId, memberId)
    .first()

  if (rel) {
    return { error: t('memberHasRelationships') }
  }

  // 3. Delete the member
  try {
    await db.prepare('DELETE FROM persons WHERE id = ?').bind(memberId).run()
  } catch (error) {
    console.error('Error deleting person:', error)
    return { error: t('memberDeleteError') }
  }

  // 4. Revalidate and redirect
  revalidatePath('/dashboard/members')
  redirect('/dashboard/members')
}

export async function updateDescendantGenerationsAction(
  personId: string,
  generationDelta: number
) {
  const { t } = await getServerTranslations()
  if (!UUID_PATTERN.test(personId)) {
    return { error: t('invalidProfile') }
  }

  if (
    generationDelta === 0 ||
    !Number.isInteger(generationDelta) ||
    Math.abs(generationDelta) > 100
  ) {
    return generationDelta === 0
      ? { success: true }
      : { error: t('invalidGenerationDelta') }
  }

  const profile = await getProfile()
  const db = getDB()

  if (
    !profile?.is_active ||
    (profile.role !== 'admin' && profile.role !== 'editor')
  ) {
    return {
      error: t('memberEditAccessDenied')
    }
  }

  // 1. Fetch all parent-child relationships
  const relsRes = await db
    .prepare(
      "SELECT person_a, person_b, type FROM relationships WHERE type IN ('biological_child', 'adopted_child')"
    )
    .all<{ person_a: string; person_b: string; type: string }>()

  const relationships = relsRes.results ?? []

  // Build children map
  const childrenMap = new Map<string, string[]>()
  relationships.forEach((r) => {
    if (!childrenMap.has(r.person_a)) childrenMap.set(r.person_a, [])
    childrenMap.get(r.person_a)!.push(r.person_b)
  })

  // 2. Find all descendants using BFS
  const descendants = new Set<string>()
  const queue = [personId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const children = childrenMap.get(current) || []
    for (const child of children) {
      if (!descendants.has(child)) {
        descendants.add(child)
        queue.push(child)
      }
    }
  }

  if (descendants.size === 0) return { success: true }
  const descendantIds = Array.from(descendants)

  // 3. Fetch current generations
  const placeholders = descendantIds.map(() => '?').join(',')
  const personsRes = await db
    .prepare(`SELECT id, generation FROM persons WHERE id IN (${placeholders})`)
    .bind(...descendantIds)
    .all<{ id: string; generation: number | null }>()

  const persons = personsRes.results ?? []

  // 4. Update generations in batch
  const updates = persons.filter((p) => p.generation != null)
  if (updates.length > 0) {
    try {
      await db.batch(
        updates.map((p) =>
          db
            .prepare('UPDATE persons SET generation = ? WHERE id = ?')
            .bind(Math.max(1, p.generation! + generationDelta), p.id)
        )
      )
    } catch (error) {
      console.error('Error updating generations:', error)
      return { error: t('descendantGenerationUpdateError') }
    }
  }

  return { success: true }
}