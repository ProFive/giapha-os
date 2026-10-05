import {
  getLocale,
  getMessages,
  Locale,
  TranslationKey,
  TranslationValues
} from '@/lib/i18n/messages'
import { hashApprovalTokenAsync } from '@/utils/approval'
import { getDB } from '@/utils/db/client'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

interface RouteContext {
  params: Promise<{ token: string }>
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

function getRequestTranslations(request: Request) {
  const localeCookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('locale='))
    ?.slice('locale='.length)

  const locale = getLocale(localeCookie)
  const dictionary = getMessages(locale)

  return {
    locale,
    t: (key: TranslationKey, values?: TranslationValues) => {
      let value: string = dictionary[key]
      if (values) {
        Object.entries(values).forEach(([name, replacement]) => {
          value = value.replace(`{${name}}`, String(replacement))
        })
      }
      return value
    }
  }
}

type Translator = (key: TranslationKey, values?: TranslationValues) => string

function htmlResponse(content: string, status = 200, locale: Locale = 'vi') {
  const title = getMessages(locale).approvalTitle

  return new NextResponse(
    `<!doctype html>
      <html lang="${locale}">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Nguyễn Tộc - ${title}</title>
        </head>
        <body style="margin:0;background:#fafaf9;font-family:Arial,sans-serif;color:#292524">
          <main style="box-sizing:border-box;max-width:560px;margin:0 auto;padding:48px 20px">
            <section style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:32px;box-shadow:0 4px 16px rgba(28,25,23,.06)">
              ${content}
            </section>
          </main>
        </body>
      </html>`,
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  )
}

async function getRequest(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return { request: null }

  const db = getDB()
  const tokenHash = await hashApprovalTokenAsync(token)
  const data = await db
    .prepare(
      'SELECT id, user_id, email, expires_at, used_at FROM user_approval_requests WHERE token_hash = ?'
    )
    .bind(tokenHash)
    .first<{
      id: string
      user_id: string
      email: string
      expires_at: string
      used_at: string | null
    }>()

  return { request: data ?? null }
}

function invalidRequestResponse(locale: Locale, t: Translator) {
  return htmlResponse(
    `<h1 style="margin-top:0;color:#991b1b">${t('approvalInvalidTitle')}</h1><p>${t('approvalInvalidText')}</p>`,
    404,
    locale
  )
}

function processedResponse(locale: Locale, t: Translator) {
  return htmlResponse(
    `<h1 style="margin-top:0;color:#166534">${t('approvalProcessedTitle')}</h1><p>${t('approvalProcessedText')}</p>`,
    200,
    locale
  )
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { locale, t } = getRequestTranslations(_request)
  try {
    const { token } = await params
    const { request } = await getRequest(token)

    if (!request) return invalidRequestResponse(locale, t)

    if (request.used_at) {
      return processedResponse(locale, t)
    }

    if (new Date(request.expires_at).getTime() <= Date.now()) {
      return invalidRequestResponse(locale, t)
    }

    return htmlResponse(
      `<h1 style="margin-top:0;color:#b45309">${t('approvalTitle')}</h1>
      <p>${t('approvalPendingText')}</p>
      <p style="font-weight:700">${escapeHtml(request.email)}</p>
      <form method="post">
        <button type="submit" style="border:0;border-radius:8px;background:#d97706;color:#fff;cursor:pointer;font-size:16px;padding:11px 18px">
          ${t('approvalConfirm')}
        </button>
      </form>
      <p style="color:#78716c;font-size:13px;margin-bottom:0">${t('approvalIgnore')}</p>
    `,
      200,
      locale
    )
  } catch (error) {
    console.error('Cannot open the pending-user approval link:', error)
    return htmlResponse(
      `<h1 style="margin-top:0;color:#991b1b">${t('approvalConfigErrorTitle')}</h1><p>${t('approvalConfigErrorText')}</p>`,
      503,
      locale
    )
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { locale, t } = getRequestTranslations(_request)
  try {
    const requestOrigin = new URL(_request.url).origin
    const requestOriginHeader = _request.headers.get('origin')
    const requestReferer = _request.headers.get('referer')
    if (
      (requestOriginHeader && requestOriginHeader !== requestOrigin) ||
      (requestReferer && !requestReferer.startsWith(`${requestOrigin}/`))
    ) {
      return htmlResponse(
        `<h1 style="margin-top:0;color:#991b1b">${t('approvalInvalidRequestTitle')}</h1>`,
        403,
        locale
      )
    }

    const { token } = await params
    const { request } = await getRequest(token)

    if (!request) return invalidRequestResponse(locale, t)

    if (request.used_at) {
      return processedResponse(locale, t)
    }

    if (new Date(request.expires_at).getTime() <= Date.now()) {
      return invalidRequestResponse(locale, t)
    }

    const db = getDB()
    const now = new Date().toISOString()

    // Atomic claim: only update if used_at is still NULL
    const claimResult = await db
      .prepare(
        'UPDATE user_approval_requests SET used_at = ? WHERE id = ? AND used_at IS NULL'
      )
      .bind(now, request.id)
      .run()

    if (!claimResult.meta.changes) {
      return processedResponse(locale, t)
    }

    const profile = await db
      .prepare('SELECT is_active FROM profiles WHERE id = ?')
      .bind(request.user_id)
      .first<{ is_active: number }>()

    if (!profile) {
      return htmlResponse(
        `<h1 style="margin-top:0;color:#991b1b">${t('approvalNotFoundTitle')}</h1><p>${t('approvalNotFoundText')}</p>`,
        404,
        locale
      )
    }

    if (!profile.is_active) {
      await db
        .prepare(
          'UPDATE profiles SET is_active = 1, updated_at = ? WHERE id = ? AND is_active = 0'
        )
        .bind(now, request.user_id)
        .run()
    }

    return htmlResponse(
      `<h1 style="margin-top:0;color:#166534">${t('approvalSuccessTitle')}</h1><p>${t('approvalSuccessText', { email: `<strong>${escapeHtml(request.email)}</strong>` })}</p>`,
      200,
      locale
    )
  } catch (error) {
    console.error('Cannot approve pending user:', error)
    return htmlResponse(
      `<h1 style="margin-top:0;color:#991b1b">${t('approvalFailureTitle')}</h1><p>${t('approvalFailureText')}</p>`,
      500,
      locale
    )
  }
}
