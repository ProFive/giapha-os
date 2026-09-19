'use server'

import { getServerTranslations } from '@/lib/i18n/server'
import { getProfile, getSupabase } from '@/utils/supabase/queries'
import { getNewsStoragePath } from '@/utils/supabase/storage-path'
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

  const supabase = await getSupabase()
  const { error } = await supabase.from('news_posts').insert({
    title: input.title.trim(),
    content: input.content.trim(),
    image_urls: input.imagePaths
  })

  if (error) {
    console.error('Error creating news post:', error)
    return { error: t('newsSaveError') }
  }

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

  const supabase = await getSupabase()
  const { error } = await supabase
    .from('news_posts')
    .update({
      title: input.title.trim(),
      content: input.content.trim(),
      image_urls: input.imagePaths
    })
    .eq('id', input.id)

  if (error) {
    console.error('Error updating news post:', error)
    return { error: t('newsSaveError') }
  }

  revalidatePath('/dashboard/news')
}

export async function deletePost(id: string) {
  const { t } = await getServerTranslations()
  const denied = await assertCanPost()
  if (denied) return denied

  if (!UUID_PATTERN.test(id)) return { error: t('newsSaveError') }

  const supabase = await getSupabase()

  const { data: post } = await supabase
    .from('news_posts')
    .select('image_urls')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('news_posts').delete().eq('id', id)

  if (error) {
    console.error('Error deleting news post:', error)
    return { error: t('newsSaveError') }
  }

  const paths = (post?.image_urls || []).map((value: string) =>
    getNewsStoragePath(value)
  )

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('news')
      .remove(paths)

    // Ảnh mồ côi không làm hỏng luồng xoá bài, chỉ ghi log.
    if (storageError) {
      console.error('Error removing news images:', storageError)
    }
  }

  revalidatePath('/dashboard/news')
}
