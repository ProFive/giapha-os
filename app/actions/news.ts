'use server'

import { getServerTranslations } from '@/lib/i18n/server'
import { getProfile } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { generateId } from '@/utils/db/auth'
import { deleteFile, parseStorageFileName } from '@/utils/r2/storage'
import { revalidatePath } from 'next/cache'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function assertCanPost() {
  const { t } = await getServerTranslations()
  const profile = await getProfile()

  if (
    !profile?.is_active ||
    (profile.role !== 'admin' && profile.role !== 'editor')
  ) {
    return { error: t('newsAccessDenied') }
  }

  return null
}

export async function createPost(input: {
  title: string
  content: string
  imagePaths: string[]
}) {
  const { t } = await getServerTranslations()
  const denied = await assertCanPost()
  if (denied) return denied

  if (!input.title.trim()) return { error: t('newsTitleRequired') }
  if (!input.content.trim()) return { error: t('newsContentRequired') }

  const db = getDB()
  const id = generateId()
  const now = new Date().toISOString()

  await db
    .prepare(
      'INSERT INTO news_posts (id, title, content, image_urls, created_at, updated_at) VALUES (?,?,?,?,?,?)'
    )
    .bind(id, input.title.trim(), input.content.trim(), JSON.stringify(input.imagePaths), now, now)
    .run()

  revalidatePath('/dashboard/news')
}

export async function updatePost(input: {
  id: string
  title: string
  content: string
  imagePaths: string[]
}) {
  const { t } = await getServerTranslations()
  const denied = await assertCanPost()
  if (denied) return denied

  if (!UUID_PATTERN.test(input.id)) return { error: t('newsSaveError') }
  if (!input.title.trim()) return { error: t('newsTitleRequired') }
  if (!input.content.trim()) return { error: t('newsContentRequired') }

  const db = getDB()
  const now = new Date().toISOString()

  await db
    .prepare(
      'UPDATE news_posts SET title = ?, content = ?, image_urls = ?, updated_at = ? WHERE id = ?'
    )
    .bind(input.title.trim(), input.content.trim(), JSON.stringify(input.imagePaths), now, input.id)
    .run()

  revalidatePath('/dashboard/news')
}

export async function deletePost(id: string) {
  const { t } = await getServerTranslations()
  const denied = await assertCanPost()
  if (denied) return denied

  if (!UUID_PATTERN.test(id)) return { error: t('newsSaveError') }

  const db = getDB()

  const post = await db
    .prepare('SELECT image_urls FROM news_posts WHERE id = ?')
    .bind(id)
    .first<{ image_urls: string }>()

  await db.prepare('DELETE FROM news_posts WHERE id = ?').bind(id).run()

  if (post?.image_urls) {
    const paths: string[] = JSON.parse(post.image_urls)
    for (const p of paths) {
      const fileName = parseStorageFileName('news', p)
      if (fileName) await deleteFile('news', fileName)
    }
  }

  revalidatePath('/dashboard/news')
}

export async function deleteComment(id: string) {
  const { t } = await getServerTranslations()

  if (!UUID_PATTERN.test(id)) return { error: t('newsCommentError') }

  const profile = await getProfile()
  if (!profile?.is_active) return { error: t('newsCommentError') }

  const db = getDB()

  // Admins can delete any comment; others can only delete their own
  const comment = await db
    .prepare('SELECT created_by FROM news_comments WHERE id = ?')
    .bind(id)
    .first<{ created_by: string | null }>()

  if (!comment) return { error: t('newsCommentError') }

  if (profile.role !== 'admin' && comment.created_by !== profile.id) {
    return { error: t('newsCommentError') }
  }

  await db.prepare('DELETE FROM news_comments WHERE id = ?').bind(id).run()

  revalidatePath('/dashboard/news')
}
