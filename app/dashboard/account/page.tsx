import ChangePasswordForm from '@/components/ChangePasswordForm'
import { getServerTranslations } from '@/lib/i18n/server'
import { getUser } from '@/utils/supabase/queries'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  const { t } = await getServerTranslations()
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className='relative flex w-full flex-1 flex-col overflow-auto bg-stone-50/50 pt-8'>
      <div className='relative z-10 mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6 lg:px-8'>
        <div className='mb-8'>
          <h1 className='title'>{t('accountTitle')}</h1>
          <p className='mt-2 max-w-2xl text-stone-500'>
            {t('accountDescription')}
          </p>
        </div>

        <div className='card-feature'>
          <p className='mb-6 text-sm text-stone-500'>{user.email}</p>
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  )
}
