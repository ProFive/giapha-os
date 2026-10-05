import DeleteMemberButton from '@/components/DeleteMemberButton'
import MemberDetailContent from '@/context/MemberDetailContent'
import { getServerTranslations } from '@/lib/i18n/server'
import { getProfile, getUser } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { t } = await getServerTranslations()
  const { id } = await params

  const user = await getUser()
  const profile = await getProfile()

  const isAdmin = profile?.role === 'admin' && Boolean(profile.is_active)
  const canEdit =
    Boolean(profile?.is_active) &&
    (profile?.role === 'admin' || profile?.role === 'editor')

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

  return (
    <div className='relative flex w-full flex-1 flex-col pb-8'>
      {/* Decorative background blurs */}
      {/* <div className="absolute -top-[20%] left-0 w-[500px] h-[500px] bg-amber-200/20 rounded-full blur-[120px] pointer-events-none" /> */}
      {/* <div className="absolute top-[40%] right-0 w-[400px] h-[400px] bg-stone-300/20 rounded-full blur-[100px] pointer-events-none" /> */}

      <div className='relative z-20 mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8'>
        <div className='flex items-center gap-3'>
          <Link
            href='/dashboard/members'
            className='-ml-2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600'
            title={t('backToMembers')}>
            <ArrowLeft className='size-5' />
          </Link>
          <h1 className='title'>{t('memberDetails')}</h1>
        </div>
        {canEdit && (
          <div className='flex w-full items-center gap-2.5 sm:w-auto'>
            <Link
              href={`/dashboard/members/${id}/edit`}
              className='btn w-full flex-1 sm:w-auto sm:flex-none'>
              {t('editMember')}
            </Link>
            <DeleteMemberButton memberId={id} className='flex-1 sm:flex-none' />
          </div>
        )}
      </div>

      <main className='relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8'>
        <div className='overflow-hidden rounded-2xl border border-stone-200/60 bg-white/60 transition-shadow duration-300'>
          <MemberDetailContent
            person={user ? typedPerson : { ...typedPerson, avatar_url: null }}
            privateData={privateData as any}
            isAdmin={isAdmin}
            canEdit={canEdit}
          />
        </div>
      </main>
    </div>
  )
}
