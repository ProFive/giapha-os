'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { Person } from '@/types'
import { calculateAge } from '@/utils/dateHelpers'
import { buildMemorialList } from '@/utils/treeHelpers'
import { downloadXlsx, XlsxCell } from '@/utils/xlsx'
import { FileSpreadsheet, Flower2, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import PersonSelector from './PersonSelector'

interface Props {
  persons: Person[]
}

export default function MemorialList({ persons }: Props) {
  const { t } = useI18n()
  const [mainId, setMainId] = useState<string | null>(null)

  const deceasedPersons = useMemo(
    () => persons.filter((p) => p.is_deceased),
    [persons]
  )

  const main = deceasedPersons.find((p) => p.id === mainId) ?? null

  const rows = useMemo(
    () => (mainId ? buildMemorialList(mainId, persons) : []),
    [mainId, persons]
  )

  const tableRows = useMemo(
    () =>
      rows.map((p) => {
        // Ưu tiên "hưởng thọ" đã nhập tay, thiếu thì tính từ năm sinh/năm mất.
        const computed = calculateAge(
          p.birth_year,
          p.birth_month,
          p.birth_day,
          p.death_year,
          p.death_month,
          p.death_day,
          p.is_deceased
        )
        return {
          id: p.id,
          fullName: p.full_name,
          dharmaName: p.dharma_name ?? '',
          ageAtDeath: p.age_at_death ?? computed?.age ?? null
        }
      }),
    [rows]
  )

  const handleExport = async () => {
    const sheetRows: XlsxCell[][] = [
      [t('memorialPageTitle')],
      [],
      [
        t('memorialStt'),
        t('memorialName'),
        t('memorialDharmaName'),
        t('memorialAgeAtDeath')
      ],
      ...tableRows.map((r, i) => [
        i + 1,
        r.fullName,
        r.dharmaName,
        r.ageAtDeath === null ? '' : t('yearsOldValue', { age: r.ageAtDeath })
      ])
    ]

    await downloadXlsx(
      `ky-sieu-${main?.full_name ?? ''}-${
        new Date().toISOString().split('T')[0]
      }.xlsx`,
      t('memorialPageTitle'),
      sheetRows,
      [6, 32, 24, 12]
    )
  }

  return (
    <div className='pb-12'>
      <div className='no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <PersonSelector
          persons={deceasedPersons}
          selectedId={mainId}
          onSelect={setMainId}
          label={t('memorialMain')}
          placeholder={t('memorialSelectMain')}
        />

        {rows.length > 0 && (
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={handleExport}
              className='inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900'>
              <FileSpreadsheet className='size-4' />
              {t('memorialExport')}
            </button>
            <button
              type='button'
              onClick={() => window.print()}
              className='inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900'>
              <Printer className='size-4' />
              {t('memorialPrint')}
            </button>
          </div>
        )}
      </div>

      {!main ? (
        <div className='flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-200 bg-white/60 px-4 py-16 text-center'>
          <div className='flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400'>
            <Flower2 className='size-6' />
          </div>
          <p className='font-medium text-stone-500'>{t('memorialEmpty')}</p>
        </div>
      ) : (
        <div
          id='print-root'
          className='overflow-hidden rounded-2xl border border-stone-200 bg-white'>
          <div className='border-b border-stone-100 px-6 py-5 text-center'>
            <h2 className='font-serif text-xl font-semibold tracking-wide text-stone-800 uppercase'>
              {t('memorialPageTitle')}
            </h2>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-stone-50 text-stone-500'>
                <tr>
                  <th className='w-16 px-6 py-3 font-medium'>
                    {t('memorialStt')}
                  </th>
                  <th className='px-6 py-3 font-medium'>{t('memorialName')}</th>
                  <th className='px-6 py-3 font-medium'>
                    {t('memorialDharmaName')}
                  </th>
                  <th className='w-28 px-6 py-3 font-medium'>
                    {t('memorialAgeAtDeath')}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-stone-100'>
                {tableRows.map((r, i) => (
                  <tr key={r.id}>
                    <td className='px-6 py-3 text-stone-400'>{i + 1}</td>
                    <td className='px-6 py-3 font-medium text-stone-800'>
                      {r.fullName}
                    </td>
                    <td className='px-6 py-3 text-stone-600'>{r.dharmaName}</td>
                    <td className='px-6 py-3 text-stone-600'>
                      {r.ageAtDeath === null
                        ? ''
                        : t('yearsOldValue', { age: r.ageAtDeath })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
