import AdminUserList from '@/components/AdminUserList'
import { getServerTranslations } from '@/lib/i18n/server'
import { AdminUserData } from '@/types'
import { getProfile } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { redirect } from 'next/navigation'

export default async function AdminUsersPage() {
  const { t } = await getServerTranslations()
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin' && Boolean(profile.is_active)

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const db = getDB()

  const [usersRes, personsRes] = await Promise.all([
    db.prepare(
      `SELECT u.id, u.email, u.created_at, p.role, p.is_active, p.person_id
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       ORDER BY u.created_at DESC`
    ).all<AdminUserData>(),
    db.prepare(
      'SELECT * FROM persons ORDER BY full_name ASC'
    ).all()
  ])

  const typedUsers = usersRes.results ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persons: any[] = personsRes.results ?? []

  return (
    <main className='relative flex w-full flex-1 flex-col overflow-auto bg-stone-50/50 pt-8'>
      <div className='relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8'>
        <div className='mb-8 flex flex-col items-start justify-between sm:flex-row sm:items-center'>
          <div>
            <h1 className='title'>{t('manageUsers')}</h1>
            <p className='mt-2 text-sm text-stone-500 sm:text-sm'>
              {t('manageUsersDescription')}
            </p>
          </div>
        </div>
        <AdminUserList
          initialUsers={typedUsers}
          currentUserId={profile.id}
          persons={persons ?? []}
        />
      </div>
    </main>
  )
}
