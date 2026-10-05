/**
 * Custom auth utilities using Web Crypto API (PBKDF2).
 * Fully compatible with Cloudflare Workers edge runtime.
 */

const ITERATIONS = 100_000
const KEY_LEN = 32 // 256 bits
const HASH = 'SHA-256'

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LEN * 8
  )
  // Convert Uint8Array to plain ArrayBuffer for PBKDF2 salt encoding
  const saltHexStr = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `v1:${ITERATIONS}:${saltHexStr}:${toHex(bits)}`
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  try {
    const [version, iterStr, saltHex, hashHex] = stored.split(':')
    if (version !== 'v1') return false
    const iterations = parseInt(iterStr, 10)
    const salt = fromHex(saltHex)
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: HASH },
      keyMaterial,
      KEY_LEN * 8
    )
    return toHex(bits) === hashHex
  } catch {
    return false
  }
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toHex(bytes.buffer)
}

export function generateId(): string {
  return crypto.randomUUID()
}

/** Session TTL: 30 days */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function getSessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString()
}

export const SESSION_COOKIE = 'giapha_session'
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_MS / 1000
}
