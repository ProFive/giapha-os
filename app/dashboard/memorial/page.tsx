import MemorialList from '@/components/MemorialList'
import { getServerTranslations } from '@/lib/i18n/server'
import { getSupabase } from '@/utils/supabase/queries'

export async function generateMetadata() {
  const { t } = await getServerTranslations()
  return { title: t('memorialPageTitle') }
}

export default async function MemorialPage() {
  const { t } = await getServerTranslations()
  const supabase = await getSupabase()

  const { data: persons } = await supabase
    .from('persons')
    .select('*')
    .order('birth_year', { ascending: true, nullsFirst: false })

  return (
    <div className='relative flex w-full flex-1 flex-col pb-12'>
      <div className='no-print relative z-20 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8'>
        <h1 className='title'>{t('memorialPageTitle')}</h1>
        <p className='mt-1 text-sm text-stone-500'>
          {t('memorialPageDescription')}
        </p>
      </div>

      <main className='mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6 lg:px-8'>
        <MemorialList persons={persons ?? []} />
      </main>
    </div>
  )
}
