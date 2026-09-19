'use client'

import NewsPostCard from '@/components/NewsPostCard'
import NewsPostModal from '@/components/modal/NewsPostModal'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { NewsPost } from '@/types'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface NewsClientProps {
  posts: NewsPost[]
  canPost: boolean
}

export default function NewsClient({ posts, canPost }: NewsClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [items, setItems] = useState<NewsPost[]>(posts)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null)

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((post) => post.id !== id))
  }

  const handleSuccess = () => {
    setIsModalOpen(false)
    setEditingPost(null)
    router.refresh()
  }

  return (
    <>
      <div className='mb-8'>
        <h1 className='title'>{t('newsTitle')}</h1>
        <p className='mt-2 text-sm text-stone-500'>{t('newsDescription')}</p>
      </div>

      {canPost && (
        <button
          type='button'
          onClick={() => {
            setEditingPost(null)
            setIsModalOpen(true)
          }}
          className='mb-6 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white'>
          {t('newsCreate')}
        </button>
      )}

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
              onEdit={(post) => {
                setEditingPost(post)
                setIsModalOpen(true)
              }}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      <NewsPostModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingPost(null)
        }}
        onSuccess={handleSuccess}
        initialData={editingPost}
      />
    </>
  )
}
