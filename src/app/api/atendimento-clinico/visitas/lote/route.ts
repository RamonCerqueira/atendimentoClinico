import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'
import { hasScaleForPatientOnDate } from '@/lib/clinicalPatientEligibility'
import { Prisma } from '@/generated/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type BatchVisitInput = { codCli: number; dataHora: string }

export async function POST(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied

  try {
    await ensureAtendimentoClinicoTables()
    const body = await request.json()
    const requested: BatchVisitInput[] = Array.isArray(body.visitas) ? body.visitas : []
    if (requested.length < 2 || requested.length > 50) {
      return NextResponse.json({ sucesso: false, mensagem: 'Selecione entre 2 e 50 idosos para o agendamento em lote' }, { status: 400 })
    }

    const visits = requested.map(item => ({ codCli: Number(item.codCli), dataHora: new Date(item.dataHora) }))
    if (visits.some(item => !Number.isInteger(item.codCli) || item.codCli < 1 || !Number.isFinite(item.dataHora.getTime()) || item.dataHora.getTime() <= Date.now())) {
      return NextResponse.json({ sucesso: false, mensagem: 'Cada idoso precisa ter uma data e um horário futuros válidos' }, { status: 400 })
    }
    const visitDays = new Set(visits.map(item => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(item.dataHora)))
    if (visitDays.size !== 1) return NextResponse.json({ sucesso: false, mensagem: 'As visitas de um lote precisam ser agendadas para o mesmo dia' }, { status: 400 })
    if (new Set(visits.map(item => item.codCli)).size !== visits.length) {
      return NextResponse.json({ sucesso: false, mensagem: 'O mesmo idoso não pode aparecer mais de uma vez no lote' }, { status: 400 })
    }
    const ordered = [...visits].sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime())
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]
      const current = ordered[index]
      if (previous && current && current.dataHora.getTime() - previous.dataHora.getTime() < 90 * 60 * 1000) {
        return NextResponse.json({ sucesso: false, mensagem: 'Os horários do lote precisam respeitar o intervalo sugerido de 90 minutos' }, { status: 400 })
      }
    }

    const userId = Number(request.headers.get('x-user-id'))
    let nurseId = userId
    if (hasPrivilegedAccess(request)) {
      nurseId = Number(body.enfermeiraCodUsu)
      if (!Number.isInteger(nurseId) || nurseId < 1) {
        return NextResponse.json({ sucesso: false, mensagem: 'Selecione uma enfermeira habilitada para as visitas' }, { status: 400 })
      }
      const permitted = await prisma.$queryRaw<any[]>`
        SELECT TOP 1 CodUsu FROM Senha
        WHERE CodUsu = ${nurseId} AND LTRIM(RTRIM(ISNULL(Perfil, ''))) = '6' AND AtendimentoClinico = 1
      `
      if (!permitted.length) return NextResponse.json({ sucesso: false, mensagem: 'A profissional selecionada não está habilitada para visitas' }, { status: 400 })
    }

    const patientIds = visits.map(item => item.codCli)
    const patients = await prisma.$queryRaw<Array<{ CodCli: number; Bairro: string | null }>>(Prisma.sql`SELECT CodCli, Bairro FROM CLIENTEs WHERE CodCli IN (${Prisma.join(patientIds)})`)
    const found = new Set(patients.map(patient => patient.CodCli))
    if (patientIds.some(id => !found.has(id))) return NextResponse.json({ sucesso: false, mensagem: 'Um ou mais idosos não foram encontrados' }, { status: 404 })
    const neighborhoods = new Set(patients.map(patient => {
      const normalized = String(patient.Bairro || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR')
      return normalized === 'BAIRRO NAO INFORMADO' ? '' : normalized
    }))
    if (neighborhoods.size !== 1) return NextResponse.json({ sucesso: false, mensagem: 'Um lote só pode incluir idosos do mesmo bairro' }, { status: 400 })

    for (const visit of visits) {
      if (!await hasScaleForPatientOnDate(visit.codCli, visit.dataHora)) {
        return NextResponse.json({ sucesso: false, mensagem: `O idoso #${visit.codCli} não possui escala ativa e equipe atribuída na data escolhida` }, { status: 400 })
      }
    }

    let created: any[]
    try { created = await prisma.$transaction(async transaction => {
      const results = []
      for (const visit of visits) {
        const conflicts = await transaction.$queryRaw<Array<{ VisitaId: number }>>`
          SELECT TOP 1 VisitaId FROM AtendimentoClinicoVisita WITH (UPDLOCK, HOLDLOCK)
          WHERE EnfermeiraCodUsu = ${nurseId}
            AND Status IN (N'PENDENTE', N'CONFIRMADA', N'EM_ATENDIMENTO')
            AND DataHora > DATEADD(second, -5400, ${visit.dataHora}) AND DataHora < DATEADD(second, 5400, ${visit.dataHora})
        `
        if (conflicts.length) throw new Error('CONFLICTO_AGENDA_ENFERMEIRA')
        const inserted = await transaction.$queryRaw<any[]>`
          INSERT INTO AtendimentoClinicoVisita (CodCli, EnfermeiraCodUsu, DataHora)
          OUTPUT INSERTED.VisitaId, INSERTED.CodCli, INSERTED.DataHora, INSERTED.Status
          VALUES (${visit.codCli}, ${nurseId}, ${visit.dataHora})
        `
        results.push(inserted[0])
        await transaction.$executeRaw`
          INSERT INTO AtendimentoClinicoAuditoria (CodUsu, Acao, Entidade, EntidadeId, CodCli, Detalhes)
          VALUES (${userId}, N'VISITA_AGENDADA', N'VISITA', ${String(inserted[0].VisitaId)}, ${visit.codCli}, N'Agendamento em lote por bairro')
        `
      }
      return results
    }, { isolationLevel: 'Serializable' }) } catch (error) {
      if (error instanceof Error && error.message === 'CONFLICTO_AGENDA_ENFERMEIRA') {
        return NextResponse.json({ sucesso: false, mensagem: 'A enfermeira já tem outra visita dentro do intervalo de 90 minutos.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ sucesso: true, visitas: created }, { status: 201 })
  } catch (error) {
    console.error('Falha ao criar lote de visitas clínicas', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível agendar as visitas selecionadas' }, { status: 500 })
  }
}
