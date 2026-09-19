'use client'

import NewsPostCard from '@/components/NewsPostCard'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { NewsPost } from '@/types'
import { useState } from 'react'

interface NewsClientProps {
  posts: NewsPost[]
  canPost: boolean
}

export default function NewsClient({ posts, canPost }: NewsClientProps) {
  const { t } = useI18n()
  const [items, setItems] = useState<NewsPost[]>(posts)

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((post) => post.id !== id))
  }

  return (
    <>
      <div className='mb-8'>
        <h1 className='title'>{t('newsTitle')}</h1>
        <p className='mt-2 text-sm text-stone-500'>{t('newsDescription')}</p>
      </div>

      {items.length === 0 ? (
        <p className='rounded-2xl border border-stone-200/60 bg-white/60 px-4 py-10 text-center text-sm text-stone-500'>
          {t('newsEmpty')}
        </p>
      ) : (
        <div className='flex flex-col gap-6'>
          {items.map((post) => (
            <NewsPostCard
              key={post.id}
              post={post}
              canPost={canPost}
              onEdit={() => {}}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </>
  )
}
