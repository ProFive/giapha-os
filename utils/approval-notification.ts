import {
  createApprovalToken,
  getApprovalTokenExpiry,
  hashApprovalTokenAsync
} from '@/utils/approval'
import { getDB } from '@/utils/db/client'
import { generateId } from '@/utils/db/auth'

interface PendingUser {
  id: string
  email: string
}

interface NotificationResult {
  sent: boolean
  configured: boolean
  reason?: string
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[character] || character
  )
}

function getConfiguredAdminEmails() {
  return (process.env.ADMIN_NOTIFICATION_EMAIL || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

async function getAdminEmails(): Promise<string[]> {
  const configured = getConfiguredAdminEmails()
  if (configured.length > 0) return configured

  const db = getDB()
  const rows = await db
    .prepare(
      `SELECT u.email FROM users u
       JOIN profiles p ON p.id = u.id
       WHERE p.role = 'admin' AND p.is_active = 1`
    )
    .all<{ email: string }>()

  return rows.results.map((r) => r.email)
}

export async function notifyAdminOfPendingUser({
  id,
  email
}: PendingUser): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const configuredAppUrl = process.env.APP_URL?.trim()
  let appUrl: string | null = null

  if (configuredAppUrl) {
    try {
      const parsed = new URL(configuredAppUrl)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        appUrl = parsed.origin
      }
    } catch {
      appUrl = null
    }
  }

  if (!apiKey || !from || !appUrl) {
    console.warn('Pending-user email not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and APP_URL.')
    return { sent: false, configured: false, reason: 'missing_configuration' }
  }

  const adminEmails = await getAdminEmails()
  if (adminEmails.length === 0) {
    console.warn('No active administrator email found.')
    return { sent: false, configured: false, reason: 'missing_admin_email' }
  }

  const db = getDB()

  const existing = await db
    .prepare(
      'SELECT id, used_at, expires_at FROM user_approval_requests WHERE user_id = ?'
    )
    .bind(id)
    .first<{ id: string; used_at: string | null; expires_at: string }>()

  if (
    existing &&
    !existing.used_at &&
    new Date(existing.expires_at).getTime() > Date.now()
  ) {
    return { sent: false, configured: true, reason: 'already_notified' }
  }

  const token = createApprovalToken()
  const tokenHash = await hashApprovalTokenAsync(token)
  const requestId = generateId()
  const expiresAt = getApprovalTokenExpiry()
  const now = new Date().toISOString()

  try {
    if (existing) {
      await db
        .prepare(
          `UPDATE user_approval_requests
           SET token_hash = ?, expires_at = ?, used_at = NULL, notified_at = NULL
           WHERE user_id = ?`
        )
        .bind(tokenHash, expiresAt, id)
        .run()
    } else {
      await db
        .prepare(
          `INSERT INTO user_approval_requests
           (id, user_id, email, token_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(requestId, id, email, tokenHash, expiresAt, now)
        .run()
    }
  } catch (error) {
    console.error('Cannot create approval request:', error)
    return { sent: false, configured: true, reason: 'database_insert_failed' }
  }

  const approveUrl = `${appUrl}/api/admin/approve/${token}`
  const safeEmail = escapeHtml(email)
  const subject = `Có tài khoản mới đang chờ duyệt: ${email}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524;max-width:640px">
      <h2 style="color:#b45309">Tài khoản mới chờ duyệt</h2>
      <p>Người dùng <strong>${safeEmail}</strong> vừa đăng ký và đang chờ phê duyệt.</p>
      <p>
        <a href="${escapeHtml(approveUrl)}" style="display:inline-block;background:#d97706;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
          Xem và duyệt tài khoản
        </a>
      </p>
      <p style="color:#78716c;font-size:13px">Liên kết có hiệu lực trong 7 ngày.</p>
    </div>
  `
  const text = `Tài khoản ${email} đang chờ duyệt. Duyệt tại: ${approveUrl}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: adminEmails, subject, html, text })
  })

  if (!res.ok) {
    console.error('Resend error:', res.status, await res.text())
    return { sent: false, configured: true, reason: 'email_send_failed' }
  }

  await db
    .prepare(
      'UPDATE user_approval_requests SET notified_at = ? WHERE user_id = ?'
    )
    .bind(now, id)
    .run()

  return { sent: true, configured: true }
}
