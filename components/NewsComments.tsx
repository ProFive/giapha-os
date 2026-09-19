'use client'

import { deleteComment } from '@/app/actions/news'
import { useUser } from '@/components/UserProvider'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { NewsComment } from '@/types'
import { Loader2, Trash } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export default function NewsComments({
  postId,
  onCountChange
}: {
  postId: string
  onCountChange?: (count: number) => void
}) {
  const { t } = useI18n()
  const { user, isAdmin, supabase } = useUser()
  const [comments, setComments] = useState<NewsComment[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('news_comments')
      .select(
        '*, author:persons!news_comments_author_person_id_fkey(id, full_name, gender, avatar_url)'
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (loadError) {
      setError(t('newsCommentError'))
    } else {
      const loaded = (data || []) as NewsComment[]
      setComments(loaded)
      onCountChange?.(loaded.length)
    }
    setLoading(false)
  }, [postId, supabase, t, onCountChange])

  useEffect(() => {
    const timeoutId = window.setTimeout(load, 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const handleSend = async () => {
    if (!draft.trim()) return
    setSending(true)
    setError(null)

    // created_by và author_person_id do trigger set_news_author điền.
    const { error: insertError } = await supabase
      .from('news_comments')
      .insert({ post_id: postId, content: draft.trim() })

    if (insertError) {
      setError(t('newsCommentError'))
    } else {
      setDraft('')
      await load()
    }
    setSending(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('newsCommentDeleteConfirm'))) return
    const result = await deleteComment(id)
    if (result?.error) {
      setError(result.error)
      return
    }
    const next = comments.filter((c) => c.id !== id)
    setComments(next)
    onCountChange?.(next.length)
  }

  return (
    <div className='mt-4 border-t border-stone-200/60 pt-4'>
      {loading ? (
        <Loader2 className='size-4 animate-spin text-stone-400' />
      ) : comments.length === 0 ? (
        <p className='text-sm text-stone-500'>{t('newsCommentEmpty')}</p>
      ) : (
        <ul className='flex flex-col gap-3'>
          {comments.map((comment) => (
            <li key={comment.id} className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-xs font-medium text-stone-700'>
                  {comment.author?.full_name ?? t('newsAnonymousAuthor')}
                </p>
                <p className='text-sm whitespace-pre-wrap text-stone-600'>
                  {comment.content}
                </p>
              </div>
              {(isAdmin || comment.created_by === user?.id) && (
                <button
                  type='button'
                  onClick={() => handleDelete(comment.id)}
                  aria-label={t('newsDelete')}
                  className='text-stone-400 transition-colors hover:text-rose-600'>
                  <Trash className='size-4' />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className='mt-3 text-sm text-rose-600'>{error}</p>}

      <div className='mt-4 flex items-center gap-2'>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('newsCommentPlaceholder')}
          className='flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm'
        />
        <button
          type='button'
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className='rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60'>
          {t('newsCommentSend')}
        </button>
      </div>
    </div>
  )
}
