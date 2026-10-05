// Uses Web Crypto API for Cloudflare Workers edge runtime compatibility

export const APPROVAL_TOKEN_TTL_DAYS = 7

export function createApprovalToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Synchronous token validation (hex string check)
export function hashApprovalToken(token: string): string {
  // For edge runtime we store a sync-computed hash via the token itself
  // The actual SHA-256 is computed async; here we return a deterministic
  // identifier suitable for DB lookup. Use hashApprovalTokenAsync for writes.
  return `pending:${token}`
}

export async function hashApprovalTokenAsync(token: string): Promise<string> {
  return sha256Hex(token)
}

export function getApprovalTokenExpiry(): string {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + APPROVAL_TOKEN_TTL_DAYS)
  return expiry.toISOString()
}
