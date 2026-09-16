'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { Person, Relationship } from '@/types'
import { calculateAge } from '@/utils/dateHelpers'
import { buildPrayerForPeaceList } from '@/utils/treeHelpers'
import { buildXlsxBlob, XlsxCell } from '@/utils/xlsx'
import { FileSpreadsheet, Printer, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import PersonSelector from './PersonSelector'

interface Props {
  persons: Person[]
  relationships: Relationship[]
  residenceByPersonId: Record<string, string>
}

export default function PrayerForPeaceList({
  persons,
  relationships,
  residenceByPersonId
}: Props) {
  const { t } = useI18n()
  const [hostId, setHostId] = useState<string | null>(null)
  const [isCathedral, setIsCathedral] = useState(false)

  const livingPersons = useMemo(
    () => persons.filter((p) => !p.is_deceased),
    [persons]
  )

  const host = livingPersons.find((p) => p.id === hostId) ?? null
  const residence = hostId ? residenceByPersonId[hostId] : undefined

  const rows = useMemo(
    () =>
      hostId
        ? buildPrayerForPeaceList(hostId, persons, relationships, {
            includeFatherSiblings: isCathedral
          })
        : [],
    [hostId, persons, relationships, isCathedral]
  )

  const tableRows = useMemo(
    () =>
      rows.map((p) => {
        const age = calculateAge(
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
          age: age ? age.age : null
        }
      }),
    [rows]
  )

  const handleExport = async () => {
    const sheetRows: XlsxCell[][] = [
      [t('prayerForPeacePageTitle')],
      [],
      [
        t('prayerForPeaceStt'),
        t('prayerForPeaceHost'),
        t('prayerForPeaceDharmaName'),
        t('prayerForPeaceAge')
      ],
      ...tableRows.map((r, i) => [i + 1, r.fullName, r.dharmaName, r.age])
    ]

    if (residence) {
      sheetRows.push([], [`${t('prayerForPeaceResidence')}: ${residence}`])
    }

    const blob = await buildXlsxBlob(
      t('prayerForPeacePageTitle'),
      sheetRows,
      [6, 32, 24, 8]
    )

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cau-an-${host?.full_name ?? ''}-${
      new Date().toISOString().split('T')[0]
    }.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='pb-12'>
      <div className='prayer-for-peace-no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <PersonSelector
            persons={livingPersons}
            selectedId={hostId}
            onSelect={setHostId}
            label={t('prayerForPeaceHost')}
            placeholder={t('prayerForPeaceSelectHost')}
          />

          <label className='flex cursor-pointer items-center gap-2.5 py-2.5 text-sm font-medium text-stone-700 select-none'>
            <input
              type='checkbox'
              checked={isCathedral}
              onChange={(e) => setIsCathedral(e.target.checked)}
              className='size-4 rounded border-stone-300 text-amber-600 accent-amber-600 focus:ring-amber-400'
            />
            {t('prayerForPeaceCathedral')}
          </label>
        </div>

        {rows.length > 0 && (
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={handleExport}
              className='inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900'>
              <FileSpreadsheet className='size-4' />
              {t('prayerForPeaceExport')}
            </button>
            <button
              type='button'
              onClick={() => window.print()}
              className='inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900'>
              <Printer className='size-4' />
              {t('prayerForPeacePrint')}
            </button>
          </div>
        )}
      </div>

      {!host ? (
        <div className='flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-200 bg-white/60 px-4 py-16 text-center'>
          <div className='flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400'>
            <Users className='size-6' />
          </div>
          <p className='font-medium text-stone-500'>
            {t('prayerForPeaceEmpty')}
          </p>
        </div>
      ) : (
        <div
          id='prayer-for-peace-print'
          className='overflow-hidden rounded-2xl border border-stone-200 bg-white'>
          <div className='border-b border-stone-100 px-6 py-5 text-center'>
            <h2 className='font-serif text-xl font-semibold tracking-wide text-stone-800 uppercase'>
              {t('prayerForPeacePageTitle')}
            </h2>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-stone-50 text-stone-500'>
                <tr>
                  <th className='w-16 px-6 py-3 font-medium'>
                    {t('prayerForPeaceStt')}
                  </th>
                  <th className='px-6 py-3 font-medium'>
                    {t('prayerForPeaceHost')}
                  </th>
                  <th className='px-6 py-3 font-medium'>
                    {t('prayerForPeaceDharmaName')}
                  </th>
                  <th className='w-24 px-6 py-3 font-medium'>
                    {t('prayerForPeaceAge')}
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
                    <td className='px-6 py-3 text-stone-600'>{r.age ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {residence && (
            <div className='border-t border-stone-100 px-6 py-4 text-sm text-stone-600'>
              <span className='font-medium text-stone-500'>
                {t('prayerForPeaceResidence')}:
              </span>{' '}
              {residence}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
