import { getDB } from '@/utils/db/client'
import {
  hashPassword,
  generateSessionToken,
  generateId,
  getSessionExpiry,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS
} from '@/utils/db/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { notifyAdminOfPendingUser } from '@/utils/approval-notification'

export async function POST(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { email, password } = await request.json() as any

    if (
      !email ||
      !password ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const db = getDB()
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.trim().toLowerCase())
      .first()

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const userId = generateId()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    await db.batch([
      db.prepare(
        'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, email.trim().toLowerCase(), passwordHash, now, now),
      db.prepare(
        'INSERT INTO profiles (id, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, 'member', 0, now, now)
    ])

    // Check if this is the very first user – make them admin and active
    const userCount = await db
      .prepare('SELECT COUNT(*) as count FROM users')
      .first<{ count: number }>()

    if (userCount && userCount.count === 1) {
      await db
        .prepare('UPDATE profiles SET role = ?, is_active = ? WHERE id = ?')
        .bind('admin', 1, userId)
        .run()

      // Auto-login first admin
      const sessionToken = generateSessionToken()
      const sessionId = generateId()
      const expiresAt = getSessionExpiry()
      await db
        .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(sessionId, userId, expiresAt)
        .run()

      const cookieStore = await cookies()
      cookieStore.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS)

      return NextResponse.json({ success: true, autoLogin: true })
    }

    // Notify admin of pending approval
    try {
      await notifyAdminOfPendingUser({ id: userId, email: email.trim().toLowerCase() })
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, autoLogin: false })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
