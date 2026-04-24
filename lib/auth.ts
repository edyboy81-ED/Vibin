/**
 * Session auth using Web Crypto (works on both Node.js and Edge runtimes).
 * Token format: `v1:<expires_ms>.<hex_hmac_sha256>`
 */

export const SESSION_COOKIE = 'vibin_session'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const enc = new TextEncoder()

function requireSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET env var is required')
  return s
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DURATION_MS
  const payload = `v1:${expires}`
  const sig = await hmacHex(payload, requireSecret())
  return `${payload}.${sig}`
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return false
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = await hmacHex(payload, requireSecret())
    if (!constantTimeEqual(sig, expected)) return false
    const [prefix, expiresStr] = payload.split(':')
    if (prefix !== 'v1') return false
    return Date.now() < Number(expiresStr)
  } catch {
    return false
  }
}
