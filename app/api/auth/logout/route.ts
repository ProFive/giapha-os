import { getDB } from '@/utils/db/client'
import { SESSION_COOKIE } from '@/utils/db/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value

  if (sessionId) {
    try {
      const db = getDB()
      await db
        .prepare('DELETE FROM sessions WHERE id = ?')
        .bind(sessionId)
        .run()
    } catch {
      // Best-effort
    }
  }

  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })

  return NextResponse.json({ success: true })
}
