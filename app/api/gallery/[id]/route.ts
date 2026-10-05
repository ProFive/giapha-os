import { getDB } from '@/utils/db/client'
import { getUser, getProfile } from '@/utils/db/queries'
import { deleteFile, parseStorageFileName } from '@/utils/r2/storage'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const db = getDB()

  const item = await db
    .prepare('SELECT image_url FROM gallery_items WHERE id = ?')
    .bind(id)
    .first<{ image_url: string }>()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.prepare('DELETE FROM gallery_items WHERE id = ?').bind(id).run()

  const fileName = parseStorageFileName('gallery', item.image_url)
  if (fileName) await deleteFile('gallery', fileName)

  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile(user.id)
  if (!profile?.is_active || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>
  const db = getDB()

  await db
    .prepare('UPDATE gallery_items SET title=?, description=?, image_url=?, event_date=? WHERE id=?')
    .bind(body.title, body.description ?? null, body.image_url, body.event_date ?? null, id)
    .run()

  return NextResponse.json({ success: true })
}
