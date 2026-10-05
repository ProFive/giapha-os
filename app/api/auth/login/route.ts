import { getDB } from '@/utils/db/client'
import {
  verifyPassword,
  generateSessionToken,
  generateId,
  getSessionExpiry,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS
} from '@/utils/db/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { email, password } = await request.json() as any

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const db = getDB()
    const user = await db
      .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
      .bind((email as string).trim().toLowerCase())
      .first<{ id: string; email: string; password_hash: string }>()

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(password as string, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const sessionId = generateId()
    const expiresAt = getSessionExpiry()

    await db
      .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(sessionId, user.id, expiresAt)
      .run()

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
