import NewsClient from '@/components/NewsClient'
import { getServerTranslations } from '@/lib/i18n/server'
import { NewsAuthor, NewsPost } from '@/types'
import { getProfile } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { r2PublicUrl } from '@/utils/r2/storage'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return { title: t('newsTitle'), description: t('newsDescription') }
}

export default async function NewsPage() {
  const db = getDB()
  const profile = await getProfile()
  const canPost =
    Boolean(profile?.is_active) &&
    (profile?.role === 'admin' || profile?.role === 'editor')

  // Fetch posts with author info via JOIN
  const postsRes = await db
    .prepare(
      `SELECT np.*,
              p.id as author_id, p.full_name as author_full_name,
              p.gender as author_gender, p.avatar_url as author_avatar_url
       FROM news_posts np
       LEFT JOIN persons p ON p.id = np.author_person_id
       ORDER BY np.created_at DESC`
    )
    .all<
      NewsPost & {
        author_id: string | null
        author_full_name: string | null
        author_gender: string | null
        author_avatar_url: string | null
      }
    >()

  // Comment counts
  const commentRes = await db
    .prepare('SELECT post_id, COUNT(*) as cnt FROM news_comments GROUP BY post_id')
    .all<{ post_id: string; cnt: number }>()

  const commentCount = new Map(
    (commentRes.results ?? []).map((r) => [r.post_id, r.cnt])
  )

  const posts: NewsPost[] = (postsRes.results ?? []).map((row) => {
    const rawPaths: string[] = JSON.parse(row.image_urls as unknown as string || '[]')
    const image_urls = rawPaths.map((p) =>
      p.startsWith('/') ? p : r2PublicUrl('news', p)
    )

    const author: NewsAuthor | null =
      row.author_id
        ? {
            id: row.author_id,
            full_name: row.author_full_name ?? '',
            gender: (row.author_gender as NewsAuthor['gender']) ?? 'other',
            avatar_url: row.author_avatar_url ?? null
          }
        : null

    return {
      ...row,
      image_urls,
      image_paths: rawPaths,
      author,
      comment_count: commentCount.get(row.id) ?? 0
    }
  })

  const latestUpdatedAt = posts.reduce(
    (latest, p) => (p.updated_at > latest ? p.updated_at : latest),
    ''
  )

  return (
    <main className='relative flex w-full flex-1 flex-col overflow-auto bg-stone-50/50 pt-8'>
      <div className='relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6 lg:px-8'>
        <NewsClient
          key={`${posts.length}-${latestUpdatedAt}`}
          posts={posts}
          canPost={canPost}
        />
      </div>
    </main>
  )
}
