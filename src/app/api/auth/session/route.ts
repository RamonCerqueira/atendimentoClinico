import { NextRequest, NextResponse } from 'next/server'
import { getClinicalActor, sessionCookieOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getClinicalActor(request)
  return user
    ? NextResponse.json({ authenticated: true, user }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
    : NextResponse.json({ authenticated: false }, { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ sucesso: true })
  response.cookies.set('clinical_session', '', sessionCookieOptions(request, 0))
  return response
}
