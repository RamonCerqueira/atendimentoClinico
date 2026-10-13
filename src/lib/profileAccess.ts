import { NextRequest, NextResponse } from 'next/server'

type AllowedProfile = '1' | '2' | '3' | '4' | '5' | '6' | '7'

export function hasPrivilegedAccess(request: NextRequest) {
  const role = String(request.headers.get('x-user-role') || '').trim().toUpperCase()
  const profile = String(request.headers.get('x-user-perfil') || '').trim()
  return profile === '3' || role === 'ADMIN' || role === 'ADM'
}

export function requireClinicalAccess(request: NextRequest, message = 'Acesso restrito à equipe clínica') {
  if (hasPrivilegedAccess(request)) return null
  const profile = String(request.headers.get('x-user-perfil') || '').trim() as AllowedProfile | ''
  if (profile === '6' && request.headers.get('x-user-atendimento-clinico') === 'true') return null
  return NextResponse.json({ sucesso: false, mensagem: message }, { status: 403 })
}
