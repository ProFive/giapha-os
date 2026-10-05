import { getDB } from '@/utils/db/client'
import { getUser } from '@/utils/db/queries'
import { NextResponse } from 'next/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const db = getDB()
  const res = await db
    .prepare('SELECT * FROM relationships WHERE person_a = ? OR person_b = ?')
    .bind(id, id)
    .all()

  return NextResponse.json({ data: res.results ?? [] })
}
