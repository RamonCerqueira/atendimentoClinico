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
    const userId = Number(request.headers.get('x-user-id'))
    const requestedVisit = Number(request.nextUrl.searchParams.get('visitaId'))
    if (!Number.isInteger(codCli) || codCli < 1 || !Number.isInteger(userId)) return NextResponse.json({ sucesso: false, mensagem: 'Paciente inválido' }, { status: 400 })
    const rows = Number.isInteger(requestedVisit) && requestedVisit > 0
      ? await prisma.$queryRaw<Array<Record<string, any>>>`SELECT TOP 1 Dados, AtualizadoEm FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId=${requestedVisit}`
      : await prisma.$queryRaw<Array<Record<string, any>>>`SELECT TOP 1 Dados, AtualizadoEm FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId IS NULL`
    let dados = null
    if (rows[0]?.Dados) { try { dados = JSON.parse(String(rows[0].Dados)) } catch { dados = null } }
    return NextResponse.json({ sucesso: true, dados, atualizadoEm: rows[0]?.AtualizadoEm || null }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao carregar rascunho clínico')
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível recuperar o rascunho clínico' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const codCli = Number(params.id)
    const userId = Number(request.headers.get('x-user-id'))
    const body = await request.json()
    const visitId = Number(body.visitaId)
    const validVisitId = Number.isInteger(visitId) && visitId > 0 ? visitId : null
    if (!Number.isInteger(codCli) || codCli < 1 || !Number.isInteger(userId)) return NextResponse.json({ sucesso: false, mensagem: 'Paciente ou profissional inválido' }, { status: 400 })
    const patient = await prisma.$queryRaw<Array<{ CodCli: number }>>`SELECT TOP 1 CodCli FROM CLIENTEs WHERE CodCli=${codCli}`
    if (!patient.length) return NextResponse.json({ sucesso: false, mensagem: 'Paciente não encontrado' }, { status: 404 })
    if (validVisitId) {
      const visits = await prisma.$queryRaw<Array<{ VisitaId: number; EnfermeiraCodUsu: number }>>`SELECT TOP 1 VisitaId, EnfermeiraCodUsu FROM AtendimentoClinicoVisita WHERE VisitaId=${validVisitId} AND CodCli=${codCli}`
      if (!visits.length || (!hasPrivilegedAccess(request) && Number(visits[0].EnfermeiraCodUsu) !== userId)) return NextResponse.json({ sucesso: false, mensagem: 'A visita não pertence a este profissional e paciente' }, { status: 403 })
    }
    const dados = JSON.stringify(body.dados ?? body.form ?? null)
    if (!dados || dados.length > 40000) return NextResponse.json({ sucesso: false, mensagem: 'O rascunho está vazio ou excede o limite permitido' }, { status: 400 })
    const existing = validVisitId
      ? await prisma.$queryRaw<Array<{ RascunhoId: number }>>`SELECT TOP 1 RascunhoId FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId=${validVisitId}`
      : await prisma.$queryRaw<Array<{ RascunhoId: number }>>`SELECT TOP 1 RascunhoId FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId IS NULL`
    if (existing.length) {
      await prisma.$executeRaw`UPDATE AtendimentoClinicoRascunho SET Dados=${dados}, AtualizadoEm=SYSUTCDATETIME() WHERE RascunhoId=${existing[0].RascunhoId}`
    } else {
      await prisma.$executeRaw`INSERT INTO AtendimentoClinicoRascunho (CodCli, EnfermeiraCodUsu, VisitaId, Dados) VALUES (${codCli}, ${userId}, ${validVisitId}, ${dados})`
    }
    return NextResponse.json({ sucesso: true, salvoEm: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao persistir rascunho clínico')
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível salvar o rascunho clínico' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    const codCli = Number(params.id)
    const userId = Number(request.headers.get('x-user-id'))
    const visitId = Number(request.nextUrl.searchParams.get('visitaId'))
    if (Number.isInteger(visitId) && visitId > 0) {
      await prisma.$executeRaw`DELETE FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId=${visitId}`
    } else {
      await prisma.$executeRaw`DELETE FROM AtendimentoClinicoRascunho WHERE CodCli=${codCli} AND EnfermeiraCodUsu=${userId} AND VisitaId IS NULL`
    }
    return NextResponse.json({ sucesso: true })
  } catch {
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível remover o rascunho clínico' }, { status: 500 })
  }
}
