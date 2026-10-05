import Footer from '@/components/Footer'
import { getServerTranslations } from '@/lib/i18n/server'
import { ArrowLeft, Database, Terminal } from 'lucide-react'
import Link from 'next/link'

export default async function SetupPage() {
  const { t } = await getServerTranslations()

  const steps = [
    {
      step: '1',
      title: 'Install Wrangler CLI',
      command: 'npm install -g wrangler'
    },
    {
      step: '2',
      title: 'Authenticate with Cloudflare',
      command: 'wrangler login'
    },
    {
      step: '3',
      title: 'Create D1 database',
      command: 'wrangler d1 create giapha-os'
    },
    {
      step: '4',
      title: 'Apply migrations',
      command: 'wrangler d1 migrations apply giapha-os'
    },
    {
      step: '5',
      title: 'Import seed data',
      command: 'wrangler d1 execute giapha-os --file=migrations/0002_seed.sql'
    }
  ]

  return (
    <div className='relative flex min-h-screen flex-col overflow-hidden bg-[#fafaf9] select-none selection:bg-amber-200 selection:text-amber-900'>
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-size-[24px_24px]'></div>
      <div className='pointer-events-none absolute inset-x-0 top-0 flex h-screen justify-center overflow-hidden'>
        <div className='absolute top-[-10%] right-[-5%] h-[50vw] max-h-[600px] w-[50vw] max-w-[600px] rounded-full bg-indigo-300/20 mix-blend-multiply blur-[100px]' />
        <div className='absolute bottom-[0%] left-[-10%] h-[60vw] max-h-[800px] w-[60vw] max-w-[800px] rounded-full bg-teal-200/20 mix-blend-multiply blur-[120px]' />
      </div>

      <div className='relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-12'>
        <div className='relative mb-8 w-full overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 sm:p-10'>
          <div className='mb-6 flex items-center gap-4'>
            <div className='rounded-2xl bg-indigo-50 p-4 text-indigo-600'>
              <Database className='size-8' />
            </div>
            <div>
              <h2 className='text-2xl font-semibold text-stone-900 sm:text-3xl'>
                Database Setup
              </h2>
              <p className='font-medium text-stone-500'>
                Initialize Cloudflare D1 database
              </p>
            </div>
          </div>

          <div className='space-y-4'>
            <p className='text-stone-600'>
              This app requires a Cloudflare D1 database. Run these commands in your terminal to get started:
            </p>

            {steps.map(({ step, title, command }) => (
              <div key={step} className='rounded-xl border border-stone-200 overflow-hidden'>
                <div className='flex items-center gap-3 bg-stone-50 px-4 py-2'>
                  <span className='flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white'>{step}</span>
                  <span className='text-sm font-medium text-stone-700'>{title}</span>
                </div>
                <div className='flex items-center gap-2 bg-[#1e1e1e] px-4 py-3'>
                  <Terminal className='size-4 shrink-0 text-stone-400' />
                  <code className='font-mono text-sm text-emerald-400'>{command}</code>
                </div>
              </div>
            ))}

            <p className='text-sm text-stone-500 mt-4'>
              After applying migrations, <Link href='/login' className='text-indigo-600 underline underline-offset-2 hover:text-indigo-800'>reload this page</Link> or navigate to <Link href='/login' className='text-indigo-600 underline underline-offset-2 hover:text-indigo-800'>/login</Link> to create your admin account.
            </p>
          </div>
        </div>
      </div>

      <Link
        href='/login'
        className='absolute top-6 left-6 z-20 flex items-center gap-2 rounded-full border border-stone-200 bg-white/60 px-5 py-2.5 text-sm font-medium text-stone-500 transition-all duration-300 hover:border-stone-300 hover:text-stone-900'>
        <ArrowLeft className='size-4' />
        {t('backToLogin')}
      </Link>

      <Footer className='relative z-10 mt-auto border-none bg-transparent' />
    </div>
  )
}
