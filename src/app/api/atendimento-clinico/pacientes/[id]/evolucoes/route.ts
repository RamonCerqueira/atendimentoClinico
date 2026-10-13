import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const codCli = Number(params.id)
    if (!Number.isInteger(codCli)) return NextResponse.json({ sucesso: false, mensagem: 'Paciente inválido' }, { status: 400 })
    const rows = await prisma.$queryRaw<any[]>`
      SELECT e.*, s.Usuario AS Enfermeira
      FROM AtendimentoClinicoEvolucao e
      LEFT JOIN Senha s ON s.CodUsu = e.EnfermeiraCodUsu
      WHERE e.CodCli = ${codCli}
      ORDER BY e.DataHora DESC
    `
    await prisma.$executeRaw`
      INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, CodCli)
      VALUES (${Number(request.headers.get('x-user-id'))}, N'PRONTUARIO_CONSULTADO', N'EVOLUCOES', ${codCli})
    `
    return NextResponse.json({ sucesso: true, evolucoes: rows })
  } catch {
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar o histórico clínico' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const codCli = Number(params.id)
    const userId = Number(request.headers.get('x-user-id'))
    const body = await request.json()
    if (!Number.isInteger(codCli) || !Number.isInteger(userId)) return NextResponse.json({ sucesso: false, mensagem: 'Paciente ou profissional inválido' }, { status: 400 })
    const patient = await prisma.$queryRaw<Array<{ CodCli: number }>>`SELECT TOP 1 CodCli FROM CLIENTEs WHERE CodCli = ${codCli}`
    if (!patient.length) return NextResponse.json({ sucesso: false, mensagem: 'Paciente não encontrado' }, { status: 404 })
    const visitId = body.visitaId !== null && body.visitaId !== undefined && body.visitaId !== '' ? Number(body.visitaId) : Number.NaN
    if (Number.isInteger(visitId)) {
      const visitRows = await prisma.$queryRaw<any[]>`
        SELECT TOP 1 VisitaId, EnfermeiraCodUsu, Status FROM AtendimentoClinicoVisita WHERE VisitaId = ${visitId} AND CodCli = ${codCli}
      `
      if (!visitRows.length) return NextResponse.json({ sucesso: false, mensagem: 'A visita selecionada não corresponde a este paciente' }, { status: 400 })
      if (!hasPrivilegedAccess(request) && Number(visitRows[0].EnfermeiraCodUsu) !== userId) return NextResponse.json({ sucesso: false, mensagem: 'Você só pode registrar evolução nas suas próprias visitas' }, { status: 403 })
      if (!['CONFIRMADA', 'EM_ATENDIMENTO'].includes(String(visitRows[0].Status))) return NextResponse.json({ sucesso: false, mensagem: 'A visita precisa estar confirmada ou em atendimento' }, { status: 400 })
    }
    const value = (key: string, max = 2000) => String(body[key] ?? '').trim().slice(0, max) || null
    const lista = (key: string) => JSON.stringify(Array.isArray(body[key]) ? body[key].map(String).slice(0, 20) : [])
    const rating = (key: string) => Number.isInteger(body[key]) && body[key] >= 1 && body[key] <= 5 ? Number(body[key]) : null
    const inserted = await prisma.$queryRaw<any[]>`
      INSERT INTO AtendimentoClinicoEvolucao
        (CodCli, EnfermeiraCodUsu, VisitaId, DataHora, PressaoArterial, Spo2,
         FrequenciaCardiaca, Temperatura, FrequenciaRespiratoria, Hgt, Consciencia,
         CondicaoGeral, Pele, Observacoes, PossuiLpp, LocalizacaoLpp, GrauLpp,
         Curativos, Lesoes, Satisfacao, SatisfacaoMonitoramentoSemana,
         SatisfacaoMonitoramentoFimSemana, SatisfacaoEquipeManha, SatisfacaoEquipeTarde,
         SatisfacaoMonitoramentoComunicacao, SatisfacaoSuporteEnfermagem,
         SatisfacaoCuidadoresDia, SatisfacaoCuidadoresNoite)
      OUTPUT INSERTED.EvolucaoId, INSERTED.CodCli, INSERTED.EnfermeiraCodUsu, INSERTED.DataHora
      VALUES (${codCli}, ${userId}, ${Number.isInteger(visitId) ? visitId : null},
        SYSUTCDATETIME(), ${value('pa', 30)}, ${value('spo2', 20)}, ${value('fc', 20)},
        ${value('temperatura', 20)}, ${value('fr', 20)}, ${value('hgt', 20)},
        ${value('consciencia', 30)}, ${value('condicaoGeral', 30)}, ${lista('pele')},
        ${value('observacoes')}, ${value('lpp', 10)}, ${value('localizacaoLpp', 300)},
        ${value('grauLpp', 50)}, ${lista('curativos')}, ${value('lesoes')}, ${value('satisfacao')},
        ${rating('satisfacaoMonitoramentoSemana')}, ${rating('satisfacaoMonitoramentoFimSemana')},
        ${rating('satisfacaoEquipeManha')}, ${rating('satisfacaoEquipeTarde')},
        ${rating('satisfacaoMonitoramentoComunicacao')}, ${rating('satisfacaoSuporteEnfermagem')},
        ${rating('satisfacaoCuidadoresDia')}, ${rating('satisfacaoCuidadoresNoite')})
    `
    if (Number.isInteger(visitId)) {
      await prisma.$executeRaw`UPDATE AtendimentoClinicoVisita SET Status = N'REALIZADA', FinalizadoEm = SYSUTCDATETIME() WHERE VisitaId = ${visitId} AND CodCli = ${codCli}`
    }
    await prisma.$executeRaw`
      INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli)
      VALUES (${userId}, N'EVOLUCAO_CRIADA', N'EVOLUCAO', ${String(inserted[0].EvolucaoId)}, ${codCli})
    `
    if (Number.isInteger(visitId)) await prisma.$executeRaw`
      INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli)
      VALUES (${userId}, N'VISITA_FINALIZADA', N'VISITA', ${String(visitId)}, ${codCli})
    `
    if (Number.isInteger(visitId)) {
      await prisma.$executeRaw`DELETE FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId=${visitId}`
    } else {
      await prisma.$executeRaw`DELETE FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId IS NULL`
    }
    return NextResponse.json({ sucesso: true, evolucao: inserted[0] }, { status: 201 })
  } catch (error) {
    console.error('Falha ao salvar evolução clínica', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível salvar a evolução clínica' }, { status: 500 })
  }
}
