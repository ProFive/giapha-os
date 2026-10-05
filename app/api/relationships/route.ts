import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { generateId } from '@/utils/db/auth'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function assertCanEdit() {
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) return null
  return profile
}

export async function POST(req: Request) {
  const profile = await assertCanEdit()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as any  // eslint-disable-line @typescript-eslint/no-explicit-any
  const { type, person_a, person_b, note } = body

  if (!['marriage', 'biological_child', 'adopted_child'].includes(type) ||
      !UUID.test(person_a) || !UUID.test(person_b) || person_a === person_b) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const db = getDB()
  const id = generateId()
  const now = new Date().toISOString()

  try {
    await db
      .prepare('INSERT INTO relationships (id, type, person_a, person_b, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, type, person_a, person_b, note ?? null, now, now)
      .run()
    return NextResponse.json({ data: { id, type, person_a, person_b, note: note ?? null } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg.includes('UNIQUE')) return NextResponse.json({ error: 'Already exists' }, { status: 409 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
