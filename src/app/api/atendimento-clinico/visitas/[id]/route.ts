import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'
import { hasScaleForPatientOnDate } from '@/lib/clinicalPatientEligibility'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied
  try {
    await ensureAtendimentoClinicoTables()
    const id = Number(params.id)
    const body = await request.json()
    if (!Number.isInteger(id)) {
      return NextResponse.json({ sucesso: false, mensagem: 'Atualização inválida' }, { status: 400 })
    }
    if (body.dataHora !== undefined) {
      const dataHora = new Date(body.dataHora)
      const userId = Number(request.headers.get('x-user-id'))
      if (!Number.isFinite(dataHora.getTime())) return NextResponse.json({ sucesso: false, mensagem: 'Data e horário inválidos' }, { status: 400 })
      if (dataHora.getTime() <= Date.now()) return NextResponse.json({ sucesso: false, mensagem: 'Escolha um horário futuro para a visita' }, { status: 400 })
      const visits = await prisma.$queryRaw<Array<{ VisitaId: number; CodCli: number; EnfermeiraCodUsu: number; Status: string }>>`
        SELECT TOP 1 VisitaId, CodCli, EnfermeiraCodUsu, Status
        FROM AtendimentoClinicoVisita WHERE VisitaId = ${id}
      `
      const visit = visits[0]
      if (!visit) return NextResponse.json({ sucesso: false, mensagem: 'Visita não encontrada' }, { status: 404 })
      if (!hasPrivilegedAccess(request) && Number(visit.EnfermeiraCodUsu) !== userId) {
        return NextResponse.json({ sucesso: false, mensagem: 'Você só pode remarcar suas próprias visitas' }, { status: 403 })
      }
      if (!['PENDENTE', 'CONFIRMADA'].includes(visit.Status)) {
        return NextResponse.json({ sucesso: false, mensagem: 'Só é possível remarcar visitas pendentes ou confirmadas' }, { status: 400 })
      }
      if (!await hasScaleForPatientOnDate(Number(visit.CodCli), dataHora)) {
        return NextResponse.json({ sucesso: false, mensagem: 'O idoso não possui escala ativa para receber esta visita nesta data' }, { status: 400 })
      }
      const updated = await prisma.$transaction(async transaction => {
        const conflicts = await transaction.$queryRaw<Array<{ VisitaId: number }>>`
          SELECT TOP 1 VisitaId FROM AtendimentoClinicoVisita WITH (UPDLOCK, HOLDLOCK)
          WHERE EnfermeiraCodUsu = ${Number(visit.EnfermeiraCodUsu)} AND VisitaId <> ${id}
            AND Status IN (N'PENDENTE', N'CONFIRMADA', N'EM_ATENDIMENTO')
            AND DataHora > DATEADD(second, -5400, ${dataHora}) AND DataHora < DATEADD(second, 5400, ${dataHora})
        `
        if (conflicts.length) return false
        await transaction.$executeRaw`UPDATE AtendimentoClinicoVisita SET DataHora = ${dataHora} WHERE VisitaId = ${id}`
        await transaction.$executeRaw`
          INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli, Detalhes)
          VALUES (${userId}, N'VISITA_REMARCADA', N'VISITA', ${String(id)}, ${Number(visit.CodCli)}, N'Data e horário alterados')
        `
        return true
      }, { isolationLevel: 'Serializable' })
      if (!updated) return NextResponse.json({ sucesso: false, mensagem: 'A enfermeira já tem outra visita dentro do intervalo de 90 minutos.' }, { status: 409 })
      return NextResponse.json({ sucesso: true })
    }
    if (body.acao === 'iniciar') {
      const userId = Number(request.headers.get('x-user-id'))
      const visits = await prisma.$queryRaw<Array<{ CodCli: number; EnfermeiraCodUsu: number; Status: string }>>`
        SELECT TOP 1 CodCli, EnfermeiraCodUsu, Status FROM AtendimentoClinicoVisita WHERE VisitaId = ${id}
      `
      const visit = visits[0]
      if (!visit) return NextResponse.json({ sucesso: false, mensagem: 'Visita não encontrada' }, { status: 404 })
      if (!hasPrivilegedAccess(request) && Number(visit.EnfermeiraCodUsu) !== userId) return NextResponse.json({ sucesso: false, mensagem: 'Você só pode iniciar suas próprias visitas' }, { status: 403 })
      if (visit.Status !== 'CONFIRMADA') return NextResponse.json({ sucesso: false, mensagem: 'Confirme a visita antes de iniciar o atendimento' }, { status: 400 })
      await prisma.$executeRaw`UPDATE AtendimentoClinicoVisita SET Status = N'EM_ATENDIMENTO', IniciadoEm = SYSUTCDATETIME() WHERE VisitaId = ${id} AND Status = N'CONFIRMADA'`
      await prisma.$executeRaw`
        INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli, Detalhes)
        VALUES (${userId}, N'VISITA_INICIADA', N'VISITA', ${String(id)}, ${Number(visit.CodCli)}, N'Atendimento iniciado pela profissional')
      `
      return NextResponse.json({ sucesso: true })
    }
    const status = body.status
    if (!['PENDENTE', 'CONFIRMADA', 'CANCELADA', 'REALIZADA'].includes(status)) {
      return NextResponse.json({ sucesso: false, mensagem: 'Atualização inválida' }, { status: 400 })
    }
    const visits = await prisma.$queryRaw<Array<{ CodCli: number; EnfermeiraCodUsu: number; Status: string }>>`
      SELECT TOP 1 CodCli, EnfermeiraCodUsu, Status FROM AtendimentoClinicoVisita WHERE VisitaId = ${id}
    `
    if (!visits.length) return NextResponse.json({ sucesso: false, mensagem: 'Visita não encontrada' }, { status: 404 })
    if (!hasPrivilegedAccess(request) && Number(visits[0]!.EnfermeiraCodUsu) !== Number(request.headers.get('x-user-id'))) {
      return NextResponse.json({ sucesso: false, mensagem: 'Você só pode atualizar suas próprias visitas' }, { status: 403 })
    }
    if (!['PENDENTE', 'CONFIRMADA'].includes(visits[0]!.Status) || !['CONFIRMADA', 'CANCELADA'].includes(status)) {
      return NextResponse.json({ sucesso: false, mensagem: 'Esta visita não permite essa alteração de status' }, { status: 400 })
    }
    await prisma.$executeRaw`UPDATE AtendimentoClinicoVisita SET Status = ${status} WHERE VisitaId = ${id}`
    const userId = Number(request.headers.get('x-user-id'))
    await prisma.$executeRaw`
      INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli)
      VALUES (${userId}, ${status === 'CONFIRMADA' ? 'VISITA_CONFIRMADA' : 'VISITA_CANCELADA'}, N'VISITA', ${String(id)}, ${Number(visits[0]!.CodCli)})
    `
    return NextResponse.json({ sucesso: true })
  } catch {
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível atualizar a visita' }, { status: 500 })
  }
}
