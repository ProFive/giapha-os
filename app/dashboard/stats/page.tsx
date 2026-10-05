import FamilyStats from '@/components/FamilyStats'
import { getServerTranslations } from '@/lib/i18n/server'
import { getSupabase } from '@/utils/supabase/queries'

export async function generateMetadata() {
  const { t } = await getServerTranslations()

  return { title: t('statsPageTitle') }
}

export default async function StatsPage() {
  const { t } = await getServerTranslations()
  const supabase = await getSupabase()

  const { data: persons } = await supabase.from('persons').select('*')
  const { data: relationships } = await supabase
    .from('relationships')
    .select('*')

  return (
    <div className='relative flex w-full flex-1 flex-col pb-12'>
      <div className='relative z-20 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8'>
        <h1 className='title'>{t('statsPageTitle')}</h1>
        <p className='mt-1 text-sm text-stone-500'>
          {t('statsPageDescription')}
        </p>
      </div>

      <main className='mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 lg:px-8'>
        <FamilyStats
          persons={persons ?? []}
          relationships={relationships ?? []}
        />
      </main>
    </div>
  )
}
