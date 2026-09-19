'use client'

import { createPost, updatePost } from '@/app/actions/news'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { NewsPost } from '@/types'
import { uploadNewsImage } from '@/utils/supabase/storage'
import { getNewsStoragePath } from '@/utils/supabase/storage-path'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, UploadCloud, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NewsPostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: NewsPost | null
}

export default function NewsPostModal({
  isOpen,
  onClose,
  onSuccess,
  initialData
}: NewsPostModalProps) {
  // Khoá cuộn nền khi mở, giống UploadModal.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <NewsPostForm
          key={initialData?.id ?? 'new'}
          onClose={onClose}
          onSuccess={onSuccess}
          initialData={initialData ?? null}
        />
      )}
    </AnimatePresence>
  )
}

interface NewsPostFormProps {
  onClose: () => void
  onSuccess: () => void
  initialData: NewsPost | null
}

function NewsPostForm({ onClose, onSuccess, initialData }: NewsPostFormProps) {
  const { t } = useI18n()
  // Mount mới với `key` ở trên reset các state này mỗi khi mở lại, nên
  // không cần đồng bộ chúng bằng effect.
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError(t('newsTitleRequired'))
      return
    }
    if (!content.trim()) {
      setError(t('newsContentRequired'))
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const uploaded: string[] = (initialData?.image_urls ?? []).map((url) =>
        getNewsStoragePath(url)
      )
      for (const file of files) {
        const { path, error: uploadError } = await uploadNewsImage(file)
        if (uploadError || !path) {
          setError(t('newsSaveError'))
          return
        }
        uploaded.push(path)
      }

      const result = initialData
        ? await updatePost({
            id: initialData.id,
            title,
            content,
            imagePaths: uploaded
          })
        : await createPost({ title, content, imagePaths: uploaded })

      if (result?.error) {
        setError(result.error)
        return
      }

      onSuccess()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4'
      onClick={onClose}>
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className='w-full max-w-lg rounded-2xl bg-white p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='font-serif text-xl font-semibold text-stone-800'>
            {initialData ? t('newsEdit') : t('newsCreate')}
          </h2>
          <button type='button' onClick={onClose} aria-label={t('close')}>
            <X className='size-5 text-stone-500' />
          </button>
        </div>

        <label className='mb-1 block text-sm text-stone-600'>
          {t('newsTitleLabel')}
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className='mb-4 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm'
        />

        <label className='mb-1 block text-sm text-stone-600'>
          {t('newsContentLabel')}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className='mb-4 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm'
        />

        <label className='mb-1 block text-sm text-stone-600'>
          {t('newsImagesLabel')}
        </label>
        <label className='mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500'>
          <UploadCloud className='size-5' />
          {files.length > 0 ? `${files.length}` : t('newsImagesLabel')}
          <input
            type='file'
            accept='image/*'
            multiple
            className='hidden'
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {error && <p className='mb-3 text-sm text-rose-600'>{error}</p>}

        <button
          type='submit'
          disabled={isSaving}
          className='flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60'>
          {isSaving && <Loader2 className='size-4 animate-spin' />}
          {initialData ? t('newsEdit') : t('newsCreate')}
        </button>
      </motion.form>
    </motion.div>
  )
}
