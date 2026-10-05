import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { generateId } from '@/utils/db/auth'
import { NextResponse } from 'next/server'

async function assertCanEdit() {
  const user = await getUser()
  if (!user) return { user: null, profile: null }
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return { user: null, profile: null }
  }
  return { user, profile }
}

export async function POST(req: Request) {
  const { user } = await assertCanEdit()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as Record<string, unknown>
  const db = getDB()
  const id = generateId()
  const now = new Date().toISOString()

  await db
    .prepare(
      'INSERT INTO gallery_items (id, title, description, image_url, event_date, created_at, created_by) VALUES (?,?,?,?,?,?,?)'
    )
    .bind(id, body.title, body.description ?? null, body.image_url, body.event_date ?? null, now, user.id)
    .run()

  return NextResponse.json({ data: { id } })
}
