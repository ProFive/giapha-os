import MemorialList from '@/components/MemorialList'
import { getDB } from '@/utils/db/client'
import { getServerTranslations } from '@/lib/i18n/server'


export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return { title: t('memorialPageTitle') }
}

export default async function MemorialPage() {
  const { t } = await getServerTranslations()
  const db = getDB()
  const [personsRes, relsRes] = await Promise.all([
    db.prepare('SELECT * FROM persons ORDER BY birth_year ASC NULLS LAST').all(),
    db.prepare('SELECT * FROM relationships').all()
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persons: any[] = personsRes.results ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relationships: any[] = relsRes.results ?? []

  return (
    <div className='relative flex w-full flex-1 flex-col pb-12'>
      <div className='no-print relative z-20 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
        <h1 className='title'>{t('memorialPageTitle')}</h1>
        <p className='mt-1 text-sm text-stone-500'>
          {t('memorialPageDescription')}
        </p>
      </div>

      <main className='mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 lg:px-8'>
        <MemorialList
          persons={persons ?? []}
          relationships={relationships ?? []}
        />
      </main>
    </div>
  )
}
