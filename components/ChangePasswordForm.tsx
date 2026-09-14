'use client'

import { changeOwnPassword } from '@/app/actions/user'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

const inputClass =
  'block w-full rounded-xl border border-stone-200/80 bg-white/50 px-4 py-3.5 text-stone-900 placeholder-stone-400 transition-all duration-200 outline-none focus:border-amber-300 focus:bg-white'

export default function ChangePasswordForm() {
  const { t } = useI18n()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('passwordRequired'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    try {
      setLoading(true)
      const result = await changeOwnPassword(currentPassword, newPassword)

      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess(t('passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <div>
        <label className='mb-1.5 block text-sm font-medium text-stone-600'>
          {t('currentPassword')}
        </label>
        <input
          type='password'
          autoComplete='current-password'
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t('currentPasswordPlaceholder')}
          className={inputClass}
        />
      </div>

      <div>
        <label className='mb-1.5 block text-sm font-medium text-stone-600'>
          {t('newPassword')}
        </label>
        <input
          type='password'
          autoComplete='new-password'
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          className={inputClass}
        />
      </div>

      <div>
        <label className='mb-1.5 block text-sm font-medium text-stone-600'>
          {t('confirmPassword')}
        </label>
        <input
          type='password'
          autoComplete='new-password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('confirmPasswordPlaceholder')}
          className={inputClass}
        />
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className='rounded-xl border border-red-200/70 bg-red-50 p-3 text-sm text-red-700'
          >
            {error}
          </motion.p>
        )}
        {success && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className='rounded-xl border border-teal-200/70 bg-teal-50 p-3 text-sm text-teal-700'
          >
            {success}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type='submit'
        disabled={loading}
        className='btn-primary mt-2 disabled:cursor-not-allowed disabled:opacity-60'
      >
        <KeyRound className='size-4' />
        {loading ? t('changingPassword') : t('changePassword')}
      </button>
    </form>
  )
}
