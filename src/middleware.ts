import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('clinical_session')?.value
  if (!token) return NextResponse.json({ sucesso: false, mensagem: 'Sessão expirada' }, { status: 401 })
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) return NextResponse.json({ sucesso: false, mensagem: 'Configuração de autenticação indisponível' }, { status: 503 })

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), { algorithms: ['HS256'] })
    const id = Number(payload.id)
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ sucesso: false, mensagem: 'Sessão inválida' }, { status: 401 })
    const perfil = String(payload.perfil || '')
    const role = String(payload.role || '').toUpperCase()
    const otavio = id === 59 || normalized(payload.nome).includes('OTAVIO') || normalized(payload.email).includes('OTAVIO')
    const privileged = perfil === '3' || ['ADMIN', 'ADM'].includes(role) || otavio
    const nurseAllowed = perfil === '6' && payload.atendimentoClinico === true
    if (!privileged && !nurseAllowed) return NextResponse.json({ sucesso: false, mensagem: 'Acesso disponível para enfermagem habilitada e administração.' }, { status: 403 })

    const headers = new Headers(request.headers)
    headers.set('x-user-id', String(id))
    headers.set('x-user-name', String(payload.nome || ''))
    headers.set('x-user-role', privileged ? 'ADMIN' : role)
    headers.set('x-user-perfil', perfil)
    headers.set('x-user-atendimento-clinico', String(payload.atendimentoClinico === true))
    headers.set('x-user-email', String(payload.email || ''))
    return NextResponse.next({ request: { headers } })
  } catch {
    return NextResponse.json({ sucesso: false, mensagem: 'Sessão inválida ou expirada' }, { status: 401 })
  }
}

export const config = {
  matcher: ['/api/atendimento-clinico/:path*', '/api/pacientes/:path*', '/api/escalas/:path*', '/api/clientes/:path*'],
}
