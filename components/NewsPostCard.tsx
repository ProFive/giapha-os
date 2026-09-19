'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { NewsPost } from '@/types'
import Image from 'next/image'

interface NewsPostCardProps {
  post: NewsPost
  canPost: boolean
  onEdit: (post: NewsPost) => void
  onDeleted: (id: string) => void
}

export default function NewsPostCard({ post }: NewsPostCardProps) {
  const { t } = useI18n()
  const authorName = post.author?.full_name ?? t('newsAnonymousAuthor')
  const createdAt = new Date(post.created_at).toLocaleDateString('vi-VN')

  return (
    <article className='rounded-2xl border border-stone-200/60 bg-white/80 p-5 sm:p-6'>
      <header className='mb-3'>
        <h2 className='font-serif text-xl font-semibold text-stone-800'>
          {post.title}
        </h2>
        <p className='mt-1 text-xs text-stone-500'>
          {authorName} · {createdAt}
        </p>
      </header>

      <p className='text-sm leading-relaxed whitespace-pre-wrap text-stone-700'>
        {post.content}
      </p>

      {post.image_urls.length > 0 && (
        <div className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3'>
          {post.image_urls.map((url) => (
            <div
              key={url}
              className='relative aspect-square overflow-hidden rounded-xl bg-stone-100'>
              <Image
                unoptimized
                src={url}
                alt={post.title}
                fill
                className='object-cover'
                sizes='(max-width: 640px) 50vw, 33vw'
              />
            </div>
          ))}
        </div>
      )}

      <footer className='mt-4 text-xs text-stone-500'>
        {t('newsCommentCount', { count: post.comment_count ?? 0 })}
      </footer>
    </article>
  )
}
