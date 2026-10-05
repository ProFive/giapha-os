import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

async function assertCanEdit() {
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) return null
  return { user, profile }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertCanEdit()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>
  const db = getDB()
  const now = new Date().toISOString()
  await db
    .prepare('UPDATE custom_events SET name=?, event_date=?, location=?, content=?, updated_at=? WHERE id=?')
    .bind(body.name, body.event_date, body.location ?? null, body.content ?? null, now, id)
    .run()
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertCanEdit()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const db = getDB()
  await db.prepare('DELETE FROM custom_events WHERE id = ?').bind(id).run()
  return NextResponse.json({ success: true })
}
