import { AuthUser, UserRole } from '@/types'
import { getSql } from '@/utils/db/client'
import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE = 'giapha_session'
const SESSION_TTL_DAYS = 30
export const MIN_PASSWORD_LENGTH = 8

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string) {
  return email.length >= 3 && email.indexOf('@') >= 1
}

/** Look up the user that owns a session token. Expired sessions count as none. */
export async function getUserBySessionToken(
  token: string | undefined
): Promise<AuthUser | null> {
  if (!token) return null

  const sql = getSql()
  const [user] = await sql<AuthUser[]>`
    SELECT u.id, u.email
    FROM public.sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()
  `
  return user ?? null
}

/** Start a session for the user and set the session cookie. */
export async function createSession(userId: string) {
  const sql = getSql()
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)

  await sql`
    INSERT INTO public.sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, ${expiresAt.toISOString()})
  `
  // Opportunistic cleanup keeps the table small without a cron job.
  await sql`DELETE FROM public.sessions WHERE expires_at <= NOW()`

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  })
}

/** End the current session and clear the session cookie. */
export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await getSql()`
      DELETE FROM public.sessions WHERE token_hash = ${hashToken(token)}
    `
  }

  cookieStore.delete(SESSION_COOKIE)
}

/** Return the user when the email/password pair matches, otherwise null. */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const [user] = await getSql()<AuthUser[]>`
    SELECT id, email
    FROM public.users
    WHERE lower(email) = ${normalizeEmail(email)}
      AND encrypted_password = crypt(${password}, encrypted_password)
  `
  return user ?? null
}

/**
 * Create a login account and its profile in one transaction. The very first
 * account becomes an active administrator; later sign-ups default to inactive
 * members awaiting approval unless the caller (an admin) says otherwise.
 */
export async function createUser(
  email: string,
  password: string,
  options?: { role: UserRole; isActive: boolean }
): Promise<{ id: string; role: UserRole; isActive: boolean }> {
  return getSql().begin(async (sql) => {
    // Serialize bootstrap so concurrent signups cannot create two administrators.
    await sql`SELECT pg_advisory_xact_lock(hashtext('giapha_os_first_user'))`
    const [{ has_users }] = await sql<{ has_users: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM public.users) AS has_users
    `

    const role: UserRole = has_users ? (options?.role ?? 'member') : 'admin'
    const isActive = has_users ? (options?.isActive ?? false) : true

    const [user] = await sql<{ id: string }[]>`
      INSERT INTO public.users (email, encrypted_password)
      VALUES (${normalizeEmail(email)}, crypt(${password}, gen_salt('bf')))
      RETURNING id
    `
    await sql`
      INSERT INTO public.profiles (id, role, is_active)
      VALUES (${user.id}, ${role}, ${isActive})
    `

    return { id: user.id, role, isActive }
  })
}

/** Replace a user's password and sign them out everywhere else. */
export async function setPassword(userId: string, password: string) {
  const sql = getSql()
  await sql`
    UPDATE public.users
    SET encrypted_password = crypt(${password}, gen_salt('bf'))
    WHERE id = ${userId}
  `
  await sql`DELETE FROM public.sessions WHERE user_id = ${userId}`
}

/** True when the password matches the user's current password. */
export async function checkPassword(userId: string, password: string) {
  const [row] = await getSql()<{ ok: boolean }[]>`
    SELECT encrypted_password = crypt(${password}, encrypted_password) AS ok
    FROM public.users
    WHERE id = ${userId}
  `
  return row?.ok === true
}
