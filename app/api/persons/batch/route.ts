import { getDB } from '@/utils/db/client'
import { getUser } from '@/utils/db/queries'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 500)

  if (ids.length === 0) return NextResponse.json({ data: [] })

  const db = getDB()
  const placeholders = ids.map(() => '?').join(',')
  const res = await db
    .prepare(`SELECT * FROM persons WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all()

  return NextResponse.json({ data: res.results ?? [] })
}
