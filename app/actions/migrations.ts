'use server'

import { getServerTranslations } from '@/lib/i18n/server'
import { getIsAdmin } from '@/utils/db/queries'
import { getDB } from '@/utils/db/client'
import packageJson from '@/package.json'

const SOURCE_REPOSITORY = 'homielab/giapha-os'
const SOURCE_BRANCH = 'main'
const SOURCE_README_URL = `https://github.com/${SOURCE_REPOSITORY}/blob/${SOURCE_BRANCH}/README.md#hướng-dẫn-cập-nhật-source-code`
const SOURCE_README_EN_URL = `https://github.com/${SOURCE_REPOSITORY}/blob/${SOURCE_BRANCH}/README.en.md#source-code-updates`
const SOURCE_PACKAGE_URL = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${SOURCE_BRANCH}/package.json`

export type SourceVersionState = 'current' | 'outdated' | 'unknown'

export interface SourceVersionStatus {
  state: SourceVersionState
  currentVersion: string | null
  latestVersion: string | null
  readmeUrl: string
  error?: string
}

export interface MigrationStatus {
  configured: boolean
  databaseReachable: boolean
  error?: string
  source: SourceVersionStatus
  d1Info?: {
    schemaReady: boolean
    personCount: number
    userCount: number
  }
}

interface ParsedVersion {
  major: number; minor: number; patch: number; prerelease: string[]
}

function parseVersion(value: unknown): ParsedVersion | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3], prerelease: m[4] ? m[4].split('.') : [] }
}

function compareVersions(l: ParsedVersion, r: ParsedVersion) {
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (l[k] !== r[k]) return l[k] > r[k] ? 1 : -1
  }
  if (!l.prerelease.length && !r.prerelease.length) return 0
  if (!l.prerelease.length) return 1
  if (!r.prerelease.length) return -1
  return 0
}

export async function getSourceVersionStatus(): Promise<SourceVersionStatus> {
  const { locale } = await getServerTranslations()
  const readmeUrl = locale === 'en' ? SOURCE_README_EN_URL : SOURCE_README_URL
  const currentVersion = parseVersion(packageJson.version)
  const currentVersionLabel = typeof packageJson.version === 'string' ? packageJson.version : null

  try {
    const response = await fetch(SOURCE_PACKAGE_URL, { next: { revalidate: 300 } })
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
    const data = (await response.json()) as { version?: unknown }
    const latestVersionLabel = typeof data.version === 'string' ? data.version : null
    const latestVersion = parseVersion(data.version)
    if (!latestVersion || !latestVersionLabel) throw new Error('Invalid version')
    const cmp = currentVersion ? compareVersions(currentVersion, latestVersion) : null
    return {
      state: cmp === null ? 'unknown' : cmp < 0 ? 'outdated' : 'current',
      currentVersion: currentVersionLabel,
      latestVersion: latestVersionLabel,
      readmeUrl
    }
  } catch {
    return { state: 'unknown', currentVersion: currentVersionLabel, latestVersion: null, readmeUrl }
  }
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const { t } = await getServerTranslations()
  const isAdmin = await getIsAdmin()
  const source = await getSourceVersionStatus()

  if (!isAdmin) {
    return {
      configured: true,
      databaseReachable: false,
      error: t('migrationAccessDenied'),
      source
    }
  }

  try {
    const db = getDB()
    const [personCount, userCount] = await Promise.all([
      db.prepare('SELECT COUNT(*) as c FROM persons').first<{ c: number }>(),
      db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>()
    ])

    return {
      configured: true,
      databaseReachable: true,
      source,
      d1Info: {
        schemaReady: true,
        personCount: personCount?.c ?? 0,
        userCount: userCount?.c ?? 0
      }
    }
  } catch (error) {
    console.error('D1 status check error:', error)
    return {
      configured: true,
      databaseReachable: false,
      error: t('migrationStatusError'),
      source
    }
  }
}

// D1 migrations are applied via wrangler CLI (`wrangler d1 migrations apply giapha-os`)
export async function runPendingMigrations() {
  const { t } = await getServerTranslations()
  return {
    success: false,
    error: t('migrationRunError') + ' — use `wrangler d1 migrations apply giapha-os` to apply migrations via CLI.'
  }
}
