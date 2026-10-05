import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { generateId } from '@/utils/db/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json()) as Record<string, unknown>
  if (!body.name || !body.event_date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = getDB()
  const id = generateId()
  const now = new Date().toISOString()
  await db
    .prepare('INSERT INTO custom_events (id, name, content, event_date, location, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, body.name, body.content ?? null, body.event_date, body.location ?? null, user.id, now, now)
    .run()
  return NextResponse.json({ data: { id } })
}
