import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { timingSafeEqual } from 'crypto'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let password: string
  try {
    const body = await req.json()
    password = body.password ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const expected = process.env.APP_PASSWORD ?? ''

  // Hash both to a fixed-length digest so timingSafeEqual never throws on length mismatch
  const hashInput = createHash('sha256').update(password).digest()
  const hashExpected = createHash('sha256').update(expected).digest()

  if (!timingSafeEqual(hashInput, hashExpected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  })
  return res
}
