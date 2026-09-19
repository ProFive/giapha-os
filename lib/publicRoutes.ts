/**
 * Routes under /dashboard that guests may read without logging in.
 *
 * This list only decides which pages are allowed to render for a guest. The
 * real gate is the database: guests are the Supabase `anon` role and can only
 * read what the anon RLS policies expose (see
 * docs/migrations/20260918000000_public_member_read_access.sql).
 */
const PUBLIC_PREFIXES = ['/dashboard/members']

/** Write routes that stay private even though their parent prefix is public. */
const PRIVATE_PATTERNS = [
  /^\/dashboard\/members\/new$/,
  /^\/dashboard\/members\/[^/]+\/edit$/
]

export function isPublicDashboardPath(pathname: string) {
  const path =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  if (PRIVATE_PATTERNS.some((pattern) => pattern.test(path))) {
    return false
  }

  return PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}
