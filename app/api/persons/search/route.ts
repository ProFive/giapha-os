import { getDB } from '@/utils/db/client'
import { getUser } from '@/utils/db/queries'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const excludeId = searchParams.get('exclude') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const recent = searchParams.get('recent') === '1'

  const db = getDB()

  if (recent) {
    const res = await db
      .prepare('SELECT * FROM persons ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all()
    return NextResponse.json({ data: res.results ?? [] })
  }

  if (q.length < 1) return NextResponse.json({ data: [] })

  const res = await db
    .prepare(
      'SELECT * FROM persons WHERE full_name LIKE ? AND id != ? ORDER BY full_name ASC LIMIT ?'
    )
    .bind(`%${q}%`, excludeId || '00000000-0000-0000-0000-000000000000', limit)
    .all()

  return NextResponse.json({ data: res.results ?? [] })
}
