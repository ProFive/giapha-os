import KinshipFinder from '@/components/KinshipFinder'
import { getServerTranslations } from '@/lib/i18n/server'
import { getDB } from '@/utils/db/client'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return { title: t('kinshipPageTitle') }
}

export default async function KinshipPage() {
  const { t } = await getServerTranslations()
  const db = getDB()

  const [personsRes, relsRes] = await Promise.all([
    db.prepare(
      'SELECT id, full_name, gender, birth_year, birth_order, generation, is_in_law, avatar_url FROM persons ORDER BY birth_year ASC NULLS LAST'
    ).all<Record<string,unknown>>(),
    db.prepare('SELECT type, person_a, person_b FROM relationships').all<Record<string,unknown>>()
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persons = (personsRes.results ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relationships = (relsRes.results ?? []) as any[]

  return (
    <div className='relative flex w-full flex-1 flex-col pb-12'>
      <div className='relative z-20 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
        <h1 className='title'>{t('kinshipPageTitle')}</h1>
        <p className='mt-1 text-sm text-stone-500'>
          {t('kinshipPageDescription')}
        </p>
      </div>

      <main className='mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 lg:px-8'>
        <KinshipFinder
          persons={persons ?? []}
          relationships={relationships ?? []}
        />
      </main>
    </div>
  )
}
