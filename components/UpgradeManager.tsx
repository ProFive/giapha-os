'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import {
  getMigrationStatus,
  type MigrationStatus
} from '@/app/actions/migrations'
import {
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ServerCog,
  Terminal
} from 'lucide-react'
import { useState } from 'react'

export default function UpgradeManager({
  initialStatus
}: {
  initialStatus: MigrationStatus
}) {
  const { t } = useI18n()
  const [status, setStatus] = useState(initialStatus)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshStatus = async () => {
    setIsRefreshing(true)
    try {
      setStatus(await getMigrationStatus())
    } finally {
      setIsRefreshing(false)
    }
  }

  const d1 = status.d1Info

  return (
    <div className='space-y-6'>
      {/* Source version status */}
      <div className='rounded-2xl border border-stone-200 bg-white p-6'>
        <div className='mb-4 flex items-center gap-3'>
          <ServerCog className='size-5 text-stone-500' />
          <h3 className='font-semibold text-stone-800'>Source Version</h3>
          <button
            onClick={refreshStatus}
            disabled={isRefreshing}
            className='ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50'>
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className='flex items-center gap-2'>
          {status.source.state === 'current' ? (
            <CheckCircle2 className='size-5 text-emerald-500' />
          ) : (
            <Loader2 className='size-5 text-amber-500' />
          )}
          <span className='text-sm text-stone-600'>
            Version: <strong>{status.source.currentVersion ?? '—'}</strong>
            {status.source.latestVersion && status.source.latestVersion !== status.source.currentVersion && (
              <> → <strong>{status.source.latestVersion}</strong></>
            )}
          </span>
        </div>
      </div>

      {/* D1 Database status */}
      <div className='rounded-2xl border border-stone-200 bg-white p-6'>
        <div className='mb-4 flex items-center gap-3'>
          <Database className='size-5 text-stone-500' />
          <h3 className='font-semibold text-stone-800'>Database Status</h3>
        </div>

        {status.databaseReachable && d1 ? (
          <div className='space-y-2 text-sm text-stone-600'>
            <div className='flex items-center gap-2'>
              <CheckCircle2 className='size-4 text-emerald-500' />
              <span>Connected</span>
            </div>
            <div className='ml-6 text-stone-500'>
              Family Members: <strong>{d1.personCount}</strong> •{' '}
              Users: <strong>{d1.userCount}</strong>
            </div>
          </div>
        ) : (
          <p className='text-sm text-amber-700'>{status.error ?? 'Database not reachable'}</p>
        )}
      </div>

      {/* D1 Migrations */}
      <div className='rounded-2xl border border-stone-200 bg-white p-6'>
        <div className='mb-4 flex items-center gap-3'>
          <Terminal className='size-5 text-stone-500' />
          <h3 className='font-semibold text-stone-800'>Migrations</h3>
        </div>
        <p className='mb-3 text-sm text-stone-500'>
          {'D1 migrations are applied via the Wrangler CLI. Run the command below in your terminal:'}
        </p>
        <div className='rounded-xl bg-[#1e1e1e] px-4 py-3 font-mono text-sm text-emerald-400'>
          wrangler d1 migrations apply giapha-os
        </div>
        {d1 && (
          <p className='mt-3 text-xs text-stone-400'>
            Current D1 schema is ready — {d1.personCount} persons loaded.
          </p>
        )}
      </div>
    </div>
  )
}
