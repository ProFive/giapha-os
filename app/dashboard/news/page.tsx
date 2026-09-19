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

  const posts = (postsData || []) as (NewsPost & {
    author: NewsAuthor | null
  })[]

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
      // Đường dẫn gốc trong bucket, chuẩn hoá nhưng KHÔNG lọc: một ảnh ký
      // thất bại vẫn phải sống sót qua vòng round-trip edit tiếp theo, dù
      // không hiển thị được (xem NewsPostModal / types.NewsPost.image_paths).
      const imagePaths = (post.image_urls || []).map((value) =>
        getNewsStoragePath(value)
      )
      const image_urls = await Promise.all(
        imagePaths.map(async (path) => {
          const { data } = await supabase.storage
            .from('news')
            .createSignedUrl(path, 60 * 60)
          return data?.signedUrl || ''
        })
      )

      return {
        ...post,
        image_urls: image_urls.filter(Boolean),
        image_paths: imagePaths,
        comment_count: commentCount.get(post.id) ?? 0
      }
    })
  )

  // router.refresh() giữ nguyên state của NewsClient theo thiết kế của React,
  // nên bài mới/bài vừa sửa không tự hiện nếu không đổi `key`. Đếm bài không
  // đổi khi sửa nội dung (length như nhau), nên phải kết hợp với updated_at
  // mới nhất trong danh sách để remount đúng lúc cả khi tạo lẫn khi sửa.
  const latestUpdatedAt = signedPosts.reduce(
    (latest, post) => (post.updated_at > latest ? post.updated_at : latest),
    ''
  )

  return (
    <main className='relative flex w-full flex-1 flex-col overflow-auto bg-stone-50/50 pt-8'>
      <div className='relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6 lg:px-8'>
        <NewsClient
          key={`${signedPosts.length}-${latestUpdatedAt}`}
          posts={signedPosts}
          canPost={canPost}
        />
      </div>
    </main>
  )
}
