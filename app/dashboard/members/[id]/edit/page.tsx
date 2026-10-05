import MemberForm from '@/components/MemberForm'
import { getServerTranslations } from '@/lib/i18n/server'
import { getProfile } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditMemberPage({ params }: PageProps) {
  const { t } = await getServerTranslations()
  const { id } = await params

  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin' && Boolean(profile.is_active)
  const isEditor = profile?.role === 'editor' && Boolean(profile.is_active)
  if (!isAdmin && !isEditor) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-stone-50'>
        <div className='text-center'>
          <h1 className='text-2xl font-semibold text-stone-800'>
            {t('accessDenied')}
          </h1>
          <p className='mt-2 text-stone-600'>{t('noEditMemberPermission')}</p>
        </div>
      </div>
    )
  }

  const db = getDB()
  const person = await db
    .prepare('SELECT * FROM persons WHERE id = ?')
    .bind(id)
    .first()

  if (!person) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedPerson = person as any

  let privateData = null
  if (isAdmin) {
    privateData = await db
      .prepare('SELECT * FROM person_details_private WHERE person_id = ?')
      .bind(id)
      .first()
  }

  const initialData = isAdmin ? { ...typedPerson, ...privateData } : { ...typedPerson }

  return (
    <div className='relative flex w-full flex-1 flex-col pb-8'>
      {/* Decorative background blurs */}
      {/* <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-amber-200/20 rounded-full blur-[120px] pointer-events-none" /> */}
      {/* <div className="absolute top-[40%] -right-[10%] w-[400px] h-[400px] bg-stone-300/20 rounded-full blur-[100px] pointer-events-none" /> */}

      <div className='relative z-20 mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'>
        <div className='flex items-center gap-3'>
          <Link
            href={`/dashboard/members/${id}`}
            className='-ml-2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600'
            title={t('backToMembers')}>
            <ArrowLeft className='size-5' />
          </Link>
          <h1 className='title'>{t('editMember')}</h1>
        </div>
      </div>

      <main className='relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8'>
        <MemberForm
          initialData={initialData}
          isEditing={true}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  )
}
