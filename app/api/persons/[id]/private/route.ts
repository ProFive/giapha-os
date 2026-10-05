import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>
  const db = getDB()
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO person_details_private (person_id, phone_number, occupation, current_residence, created_at, updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(person_id) DO UPDATE SET phone_number=excluded.phone_number, occupation=excluded.occupation, current_residence=excluded.current_residence, updated_at=excluded.updated_at`
    )
    .bind(id, body.phone_number ?? null, body.occupation ?? null, body.current_residence ?? null, now, now)
    .run()

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const db = getDB()
  await db.prepare('DELETE FROM person_details_private WHERE person_id = ?').bind(id).run()
  return NextResponse.json({ success: true })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const db = getDB()
  const data = await db
    .prepare('SELECT * FROM person_details_private WHERE person_id = ?')
    .bind(id)
    .first()
  return NextResponse.json({ data: data ?? {} })
}
