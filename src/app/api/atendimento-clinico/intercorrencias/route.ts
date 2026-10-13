import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const categories = new Set(['QUEDA', 'ALTERACAO_CLINICA', 'MEDICACAO', 'LESÃO', 'COMPORTAMENTO', 'OUTRA'])
const severities = new Set(['BAIXA', 'MODERADA', 'ALTA', 'CRITICA'])

export async function GET(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const userId = Number(request.headers.get('x-user-id'))
    const admin = hasPrivilegedAccess(request)
    const status = String(request.nextUrl.searchParams.get('status') || '').toUpperCase()
    const patient = Number(request.nextUrl.searchParams.get('idoso'))
    const from = request.nextUrl.searchParams.get('inicio') || ''
    const to = request.nextUrl.searchParams.get('fim') || ''
    const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT TOP 500 i.IntercorrenciaId, i.CodCli, COALESCE(c.Cliente, c.Razao) AS NomePaciente,
        c.Bairro, c.Cidade, i.VisitaId, i.EnfermeiraCodUsu, s.Usuario AS Enfermeira,
        i.Categoria, i.Gravidade, i.Relato, i.Conduta, i.Encaminhamento, i.Status,
        i.DataHora, i.ResolvidaEm, i.ResolvidaPor
      FROM AtendimentoClinicoIntercorrencia i
      LEFT JOIN CLIENTEs c ON c.CodCli=i.CodCli
      LEFT JOIN Senha s ON s.CodUsu=i.EnfermeiraCodUsu
      WHERE (${admin ? 1 : 0}=1 OR i.EnfermeiraCodUsu=${userId})
        AND (${Number.isInteger(patient) && patient > 0 ? 1 : 0}=0 OR i.CodCli=${Number.isInteger(patient) && patient > 0 ? patient : 0})
        AND (${status && ['ABERTA','EM_ACOMPANHAMENTO','RESOLVIDA'].includes(status) ? 1 : 0}=0 OR i.Status=${status})
        AND (${/^\d{4}-\d{2}-\d{2}$/.test(from) ? 1 : 0}=0 OR i.DataHora>=CAST(${from || '1900-01-01'} AS date))
        AND (${/^\d{4}-\d{2}-\d{2}$/.test(to) ? 1 : 0}=0 OR i.DataHora<DATEADD(day,1,CAST(${to || '9999-12-30'} AS date)))
      ORDER BY CASE WHEN i.Status=N'RESOLVIDA' THEN 1 ELSE 0 END, i.DataHora DESC
    `
    return NextResponse.json({ sucesso: true, intercorrencias: rows }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    console.error('Falha ao carregar intercorrências clínicas')
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar intercorrências.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const body = await request.json()
    const codCli = Number(body.codCli)
    const userId = Number(request.headers.get('x-user-id'))
    const visitId = Number(body.visitaId)
    const categoria = String(body.categoria || '').trim().toUpperCase()
    const gravidade = String(body.gravidade || '').trim().toUpperCase()
    const relato = String(body.relato || '').trim()
    if (!Number.isInteger(codCli) || codCli < 1 || !categories.has(categoria) || !severities.has(gravidade) || !relato) {
      return NextResponse.json({ sucesso: false, mensagem: 'Informe idoso, tipo, gravidade e relato da intercorrência.' }, { status: 400 })
    }
    const patient = await prisma.$queryRaw<Array<{ CodCli: number }>>`SELECT TOP 1 CodCli FROM CLIENTEs WHERE CodCli=${codCli}`
    if (!patient.length) return NextResponse.json({ sucesso: false, mensagem: 'Idoso não encontrado.' }, { status: 404 })
    const validVisit = Number.isInteger(visitId) && visitId > 0 ? visitId : null
    if (validVisit) {
      const visits = await prisma.$queryRaw<Array<{ VisitaId: number; EnfermeiraCodUsu: number }>>`SELECT TOP 1 VisitaId, EnfermeiraCodUsu FROM AtendimentoClinicoVisita WHERE VisitaId=${validVisit} AND CodCli=${codCli}`
      if (!visits.length || (!hasPrivilegedAccess(request) && Number(visits[0].EnfermeiraCodUsu) !== userId)) return NextResponse.json({ sucesso: false, mensagem: 'A visita selecionada não pertence a este registro.' }, { status: 403 })
    }
    const rows = await prisma.$queryRaw<Array<Record<string, any>>>`
      INSERT INTO AtendimentoClinicoIntercorrencia (CodCli, VisitaId, EnfermeiraCodUsu, Categoria, Gravidade, Relato, Conduta, Encaminhamento)
      OUTPUT INSERTED.IntercorrenciaId, INSERTED.CodCli, INSERTED.VisitaId, INSERTED.EnfermeiraCodUsu, INSERTED.Categoria,
        INSERTED.Gravidade, INSERTED.Relato, INSERTED.Conduta, INSERTED.Encaminhamento, INSERTED.Status, INSERTED.DataHora
      VALUES (${codCli}, ${validVisit}, ${userId}, ${categoria}, ${gravidade}, ${relato.slice(0, 10000)}, ${String(body.conduta || '').trim().slice(0, 10000) || null}, ${String(body.encaminhamento || '').trim().slice(0, 300) || null})
    `
    const record = rows[0]
    await prisma.$executeRaw`INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli) VALUES (${userId}, N'INTERCORRENCIA_CRIADA', N'INTERCORRENCIA', ${String(record.IntercorrenciaId)}, ${codCli})`
    return NextResponse.json({ sucesso: true, intercorrencia: record }, { status: 201 })
  } catch {
    console.error('Falha ao registrar intercorrência clínica')
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível registrar a intercorrência.' }, { status: 500 })
  }
}
