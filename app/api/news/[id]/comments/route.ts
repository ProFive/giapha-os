import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { generateId } from '@/utils/db/auth'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDB()

  // Fetch comments with author info
  const res = await db
    .prepare(
      `SELECT nc.*,
              p.id as author_id, p.full_name as author_full_name,
              p.gender as author_gender, p.avatar_url as author_avatar_url
       FROM news_comments nc
       LEFT JOIN persons p ON p.id = nc.author_person_id
       WHERE nc.post_id = ?
       ORDER BY nc.created_at ASC`
    )
    .bind(id)
    .all<{
      id: string; post_id: string; content: string; created_by: string | null; created_at: string
      author_person_id: string | null
      author_id: string | null; author_full_name: string | null
      author_gender: string | null; author_avatar_url: string | null
    }>()

  const comments = (res.results ?? []).map((row) => ({
    id: row.id,
    post_id: row.post_id,
    content: row.content,
    author_person_id: row.author_person_id,
    created_by: row.created_by,
    created_at: row.created_at,
    author: row.author_id ? {
      id: row.author_id,
      full_name: row.author_full_name ?? '',
      gender: row.author_gender ?? 'other',
      avatar_url: row.author_avatar_url ?? null
    } : null
  }))

  return NextResponse.json({ data: comments })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: postId } = await params
  const body = (await req.json()) as any  // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const db = getDB()
  const commentId = generateId()
  const now = new Date().toISOString()

  // Link comment to the user's person if they have one
  await db
    .prepare(
      'INSERT INTO news_comments (id, post_id, content, author_person_id, created_by, created_at) VALUES (?,?,?,?,?,?)'
    )
    .bind(commentId, postId, body.content.trim(), profile.person_id ?? null, user.id, now)
    .run()

  return NextResponse.json({ success: true })
}
