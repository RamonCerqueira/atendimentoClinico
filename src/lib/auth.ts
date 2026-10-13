import { jwtVerify, SignJWT } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

export type ClinicalActor = {
  id: number
  nome: string
  email: string
  role: string
  perfil: string
  atendimentoClinico: boolean
  equipe?: string | null
}

function secret() {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error('JWT_SECRET não está configurada no ambiente compartilhado do SoftCare.')
  return new TextEncoder().encode(value)
}

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

export function isOtavio(actor: Partial<ClinicalActor>) {
  return Number(actor.id) === 59 || normalize(actor.nome).includes('OTAVIO') || normalize(actor.email).includes('OTAVIO')
}

export function isPrivilegedActor(actor: ClinicalActor) {
  return actor.perfil === '3' || ['ADMIN', 'ADM'].includes(actor.role.toUpperCase()) || isOtavio(actor)
}

export function canUseClinicalApp(actor: ClinicalActor) {
  return isPrivilegedActor(actor) || (actor.perfil === '6' && actor.atendimentoClinico)
}

export async function createClinicalToken(actor: ClinicalActor, maxAgeSeconds = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    id: actor.id,
    nome: actor.nome,
    email: actor.email,
    role: actor.role,
    perfil: actor.perfil,
    atendimentoClinico: actor.atendimentoClinico,
    equipe: actor.equipe ?? null,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSeconds)
    .sign(secret())
}

export async function getClinicalActor(request: NextRequest): Promise<ClinicalActor | null> {
  const token = request.cookies.get('clinical_session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    const id = Number(payload.id)
    if (!Number.isInteger(id) || id < 1) return null
    const actor: ClinicalActor = {
      id,
      nome: String(payload.nome || 'Usuário'),
      email: String(payload.email || ''),
      role: String(payload.role || 'USER'),
      perfil: String(payload.perfil || ''),
      atendimentoClinico: payload.atendimentoClinico === true,
      equipe: payload.equipe ? String(payload.equipe) : null,
    }
    return canUseClinicalApp(actor) ? actor : null
  } catch {
    return null
  }
}

export function authError(message = 'Sessão expirada') {
  return NextResponse.json({ sucesso: false, mensagem: message }, { status: 401 })
}

export function permissionError(message = 'Acesso restrito à equipe clínica') {
  return NextResponse.json({ sucesso: false, mensagem: message }, { status: 403 })
}

export function sessionCookieOptions(request: NextRequest, maxAge: number) {
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https' || process.env.SESSION_COOKIE_SECURE === 'true'
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge }
}
