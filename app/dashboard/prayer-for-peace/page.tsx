import PrayerForPeaceList from '@/components/PrayerForPeaceList'
import { getServerTranslations } from '@/lib/i18n/server'
import { getSupabase } from '@/utils/supabase/queries'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return { title: t('prayerForPeacePageTitle') }
}

export default async function PrayerForPeacePage() {
  const { t } = await getServerTranslations()
  const supabase = await getSupabase()

  const { data: persons } = await supabase
    .from('persons')
    .select('*')
    .order('birth_year', { ascending: true, nullsFirst: false })

  const { data: relationships } = await supabase
    .from('relationships')
    .select('*')

  // Địa chỉ thường trú nằm ở bảng riêng tư; RLS quyết định người dùng có đọc được hay không.
  const { data: privateDetails } = await supabase
    .from('person_details_private')
    .select('person_id, current_residence')

  const residenceByPersonId: Record<string, string> = {}
  privateDetails?.forEach((d) => {
    if (d.current_residence)
      residenceByPersonId[d.person_id] = d.current_residence
  })

  return (
    <div className='relative flex w-full flex-1 flex-col pb-12'>
      <div className='prayer-for-peace-no-print relative z-20 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
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
