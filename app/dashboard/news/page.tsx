import NewsClient from '@/components/NewsClient'
import { getServerTranslations } from '@/lib/i18n/server'
import { NewsAuthor, NewsPost } from '@/types'
import { getProfile, getSupabase } from '@/utils/supabase/queries'
import { getNewsStoragePath } from '@/utils/supabase/storage-path'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return {
    title: t('newsTitle'),
    description: t('newsDescription')
  }
}

export default async function NewsPage() {
  const supabase = await getSupabase()
  const profile = await getProfile()
  const canPost =
    profile?.is_active === true &&
    (profile.role === 'admin' || profile.role === 'editor')

  const { data: postsData } = await supabase
    .from('news_posts')
    .select(
      '*, author:persons!news_posts_author_person_id_fkey(id, full_name, gender, avatar_url)'
    )
    .order('created_at', { ascending: false })

  const posts = (postsData || []) as (NewsPost & { author: NewsAuthor | null })[]

  // Đếm bình luận trong một truy vấn thay vì mỗi bài một truy vấn.
  const { data: commentRows } = await supabase
    .from('news_comments')
    .select('post_id')

  const commentCount = new Map<string, number>()
  ;(commentRows || []).forEach((row: { post_id: string }) => {
    commentCount.set(row.post_id, (commentCount.get(row.post_id) ?? 0) + 1)
  })

  const signedPosts = await Promise.all(
    posts.map(async (post) => {
      const image_urls = await Promise.all(
        (post.image_urls || []).map(async (value) => {
          const { data } = await supabase.storage
            .from('news')
            .createSignedUrl(getNewsStoragePath(value), 60 * 60)
          return data?.signedUrl || ''
        })
      )

      return {
        ...post,
        image_urls: image_urls.filter(Boolean),
        comment_count: commentCount.get(post.id) ?? 0
      }
    })
  )

  return (
    <main className='relative flex w-full flex-1 flex-col overflow-auto bg-stone-50/50 pt-8'>
      <div className='relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6 lg:px-8'>
        <NewsClient posts={signedPosts} canPost={canPost} />
      </div>
    </main>
  )
}
