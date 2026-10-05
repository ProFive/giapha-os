'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'

export default function LogoutButton() {
  const router = useRouter()
  const { t } = useI18n()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      setIsLoggingOut(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className='flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-rose-50 hover:text-rose-700'>
      <LogOut className='size-4' />
      {isLoggingOut ? t('processing') : t('logout')}
    </button>
  )
}
