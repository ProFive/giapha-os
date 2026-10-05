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
  if (!body.full_name || !body.gender) {
    return NextResponse.json({ error: 'full_name and gender required' }, { status: 400 })
  }

  const db = getDB()
  const id = generateId()
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO persons (id, full_name, gender, birth_year, birth_month, birth_day,
        death_year, death_month, death_day, is_deceased, is_in_law, birth_order, generation,
        other_names, note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      id, body.full_name, body.gender,
      body.birth_year ?? null, body.birth_month ?? null, body.birth_day ?? null,
      body.death_year ?? null, body.death_month ?? null, body.death_day ?? null,
      body.is_deceased ? 1 : 0, body.is_in_law ? 1 : 0,
      body.birth_order ?? null, body.generation ?? null,
      body.other_names ?? null, body.note ?? null,
      now, now
    )
    .run()

  const person = await db.prepare('SELECT * FROM persons WHERE id = ?').bind(id).first()
  return NextResponse.json({ data: person })
}

export async function PUT(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getDB()
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE persons SET full_name=?, gender=?, birth_year=?, birth_month=?, birth_day=?,
        death_year=?, death_month=?, death_day=?, is_deceased=?, is_in_law=?,
        birth_order=?, generation=?, other_names=?, note=?, updated_at=?
       WHERE id=?`
    )
    .bind(
      body.full_name, body.gender,
      body.birth_year ?? null, body.birth_month ?? null, body.birth_day ?? null,
      body.death_year ?? null, body.death_month ?? null, body.death_day ?? null,
      body.is_deceased ? 1 : 0, body.is_in_law ? 1 : 0,
      body.birth_order ?? null, body.generation ?? null,
      body.other_names ?? null, body.note ?? null,
      now, body.id
    )
    .run()

  const person = await db.prepare('SELECT * FROM persons WHERE id = ?').bind(body.id).first()
  return NextResponse.json({ data: person })
}
