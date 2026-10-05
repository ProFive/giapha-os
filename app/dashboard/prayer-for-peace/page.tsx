import PrayerForPeaceList from '@/components/PrayerForPeaceList'
import { getServerTranslations } from '@/lib/i18n/server'
import { getDB } from '@/utils/db/client'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return { title: t('prayerForPeacePageTitle') }
}

export default async function PrayerForPeacePage() {
  const { t } = await getServerTranslations()
  const db = getDB()

  const [personsRes, relsRes, privateRes] = await Promise.all([
    db.prepare('SELECT * FROM persons ORDER BY birth_year ASC NULLS LAST').all(),
    db.prepare('SELECT * FROM relationships').all(),
    db.prepare('SELECT person_id, current_residence FROM person_details_private').all<{
      person_id: string
      current_residence: string | null
    }>()
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persons: any[] = personsRes.results ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relationships: any[] = relsRes.results ?? []

  const residenceByPersonId: Record<string, string> = {}
  for (const d of privateRes.results ?? []) {
    if (d.current_residence) residenceByPersonId[d.person_id] = d.current_residence
  }

  return (
    <div className='relative flex w-full flex-1 flex-col pb-12'>
      <div className='no-print relative z-20 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
        <h1 className='title'>{t('prayerForPeacePageTitle')}</h1>
        <p className='mt-1 text-sm text-stone-500'>
          {t('prayerForPeacePageDescription')}
        </p>
      </div>

      <main className='mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 lg:px-8'>
        <PrayerForPeaceList
          persons={persons ?? []}
          relationships={relationships ?? []}
          residenceByPersonId={residenceByPersonId}
        />
      </main>
    </div>
  )
}
