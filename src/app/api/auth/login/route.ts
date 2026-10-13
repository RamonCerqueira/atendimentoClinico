import { NextRequest, NextResponse } from 'next/server'
import { createClinicalToken, isOtavio, sessionCookieOptions } from '@/lib/auth'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function clean(value: unknown) {
  return String(value ?? '').trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const login = clean(body.email)
    const password = clean(body.password)
    if (!login || !password) return NextResponse.json({ sucesso: false, mensagem: 'Usuário e senha são obrigatórios' }, { status: 400 })

    await ensureAtendimentoClinicoTables()
    const users = await prisma.$queryRaw<Array<{
      CodUsu: number; Usuario: string | null; EMail: string | null; Senha: string | null;
      Perfil: string | null; AtendimentoClinico: boolean | null; Equipe: string | null;
    }>>`
      SELECT TOP 1 CodUsu, Usuario, EMail, Senha, Perfil, AtendimentoClinico, Equipe
      FROM Senha
      WHERE LOWER(LTRIM(RTRIM(ISNULL(Usuario, '')))) = LOWER(${login})
        OR LOWER(LTRIM(RTRIM(ISNULL(EMail, '')))) = LOWER(${login})
      ORDER BY CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(EMail, '')))) = LOWER(${login}) THEN 0 ELSE 1 END
    `
    const row = users[0]
    const storedPassword = clean(row?.Senha)
    const passwordMatches = Boolean(row && (storedPassword === password || (storedPassword.length === 4 && password.startsWith(storedPassword))))
    if (!row || !passwordMatches) return NextResponse.json({ sucesso: false, mensagem: 'Credenciais inválidas' }, { status: 401 })

    const perfil = clean(row.Perfil)
    const nome = clean(row.Usuario) || `Usuário ${row.CodUsu}`
    const email = clean(row.EMail) || `${nome}@sistema.local`
    const elevated = perfil === '3' || isOtavio({ id: row.CodUsu, nome, email })
    const authorizedNurse = perfil === '6' && row.AtendimentoClinico === true
    if (!elevated && !authorizedNurse) {
      return NextResponse.json({ sucesso: false, mensagem: 'Acesso disponível para enfermagem habilitada e administração.' }, { status: 403 })
    }

    const actor = {
      id: Number(row.CodUsu), nome, email, perfil,
      role: elevated ? 'ADMIN' : 'SUPERVISOR',
      atendimentoClinico: row.AtendimentoClinico === true,
      equipe: clean(row.Equipe) || null,
    }
    const token = await createClinicalToken(actor)
    const response = NextResponse.json({ sucesso: true, user: actor })
    response.cookies.set('clinical_session', token, sessionCookieOptions(request, 8 * 60 * 60))
    return response
  } catch (error) {
    console.error('Falha de autenticação no backend clínico', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível autenticar no banco de dados do SoftCare.' }, { status: 500 })
  }
}
