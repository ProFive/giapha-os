'use client'

import { deletePost } from '@/app/actions/news'
import NewsComments from '@/components/NewsComments'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { NewsPost } from '@/types'
import { Pencil, Trash } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

interface NewsPostCardProps {
  post: NewsPost
  canPost: boolean
  onEdit: (post: NewsPost) => void
  onDeleted: (id: string) => void
}

export default function NewsPostCard({
  post,
  canPost,
  onEdit,
  onDeleted
}: NewsPostCardProps) {
  const { t } = useI18n()
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0)
  const authorName = post.author?.full_name ?? t('newsAnonymousAuthor')
  const createdAt = new Date(post.created_at).toLocaleDateString('vi-VN')

  const handleDelete = async () => {
    if (!window.confirm(t('newsDeleteConfirm'))) return
    const result = await deletePost(post.id)
    if (result?.error) return
    onDeleted(post.id)
  }

  return (
    <article className='rounded-2xl border border-stone-200/60 bg-white/80 p-5 sm:p-6'>
      <header className='mb-3 flex items-start justify-between gap-3'>
        <div>
          <h2 className='font-serif text-xl font-semibold text-stone-800'>
            {post.title}
          </h2>
          <p className='mt-1 text-xs text-stone-500'>
            {authorName} · {createdAt}
          </p>
        </div>

        {canPost && (
          <div className='flex shrink-0 items-center gap-2'>
            <button
              type='button'
              onClick={() => onEdit(post)}
              aria-label={t('newsEdit')}
              className='rounded-full p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800'>
              <Pencil className='size-4' />
            </button>
            <button
              type='button'
              onClick={handleDelete}
              aria-label={t('newsDelete')}
              className='rounded-full p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600'>
              <Trash className='size-4' />
            </button>
          </div>
        )}
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

      <footer className='mt-4'>
        <button
          type='button'
          onClick={() => setShowComments((prev) => !prev)}
          className='text-xs font-medium text-stone-500 transition-colors hover:text-amber-700'>
          {t('newsCommentCount', { count: commentCount })}
        </button>
        {showComments && (
          <NewsComments postId={post.id} onCountChange={setCommentCount} />
        )}
      </footer>
    </article>
  )
}
