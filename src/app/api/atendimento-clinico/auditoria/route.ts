import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/client'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  if (!hasPrivilegedAccess(request)) return NextResponse.json({ sucesso: false, mensagem: 'Auditoria disponível apenas para a administração' }, { status: 403 })
  try {
    await ensureAtendimentoClinicoTables()
    const params = request.nextUrl.searchParams
    const filters: Prisma.Sql[] = []
    const from = params.get('inicio') || ''
    const to = params.get('fim') || ''
    const userId = Number(params.get('profissional'))
    const patientId = Number(params.get('idoso'))
    const action = String(params.get('acao') || '').trim().slice(0, 60)
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) filters.push(Prisma.sql`a.CriadoEm >= CAST(${from} AS date)`)
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) filters.push(Prisma.sql`a.CriadoEm < DATEADD(day, 1, CAST(${to} AS date))`)
    if (Number.isInteger(userId) && userId > 0) filters.push(Prisma.sql`a.CodUsu = ${userId}`)
    if (Number.isInteger(patientId) && patientId > 0) filters.push(Prisma.sql`a.CodCli = ${patientId}`)
    if (action) filters.push(Prisma.sql`a.Acao = ${action}`)
    const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty
    const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT TOP 500 a.AuditoriaId, a.CodUsu, COALESCE(s.Usuario, CONCAT(N'Usuário ', a.CodUsu)) AS Profissional,
        a.Acao, a.Entidade, a.EntidadeId, a.CodCli, COALESCE(c.Cliente, c.Razao) AS NomePaciente,
        a.Detalhes, a.CriadoEm
      FROM AtendimentoClinicoAuditoria a
      LEFT JOIN Senha s ON s.CodUsu = a.CodUsu
      LEFT JOIN CLIENTEs c ON c.CodCli = a.CodCli
      ${where}
      ORDER BY a.CriadoEm DESC, a.AuditoriaId DESC
    `)
    return NextResponse.json({ sucesso: true, registros: rows }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao carregar auditoria clínica', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar a auditoria clínica' }, { status: 500 })
  }
}
