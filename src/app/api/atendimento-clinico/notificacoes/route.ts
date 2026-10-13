import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess, requireClinicalAccess } from '@/lib/profileAccess'
import { brazilDateKey } from '@/lib/clinicalPatientEligibility'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const denied = requireClinicalAccess(request)
  if (denied) return denied

  try {
    await ensureAtendimentoClinicoTables()
    const userId = Number(request.headers.get('x-user-id'))
    const isAdmin = hasPrivilegedAccess(request)
    const today = brazilDateKey(new Date())!
    const visitsPromise = prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT v.VisitaId, v.CodCli, COALESCE(c.Cliente, c.Razao) AS NomePaciente,
        v.DataHora, v.Status, v.EnfermeiraCodUsu, s.Usuario AS Enfermeira,
        e.EvolucaoId
      FROM AtendimentoClinicoVisita v
      LEFT JOIN CLIENTEs c ON c.CodCli = v.CodCli
      LEFT JOIN Senha s ON s.CodUsu = v.EnfermeiraCodUsu
      OUTER APPLY (
        SELECT TOP 1 EvolucaoId FROM AtendimentoClinicoEvolucao ev
        WHERE ev.VisitaId = v.VisitaId ORDER BY ev.DataHora DESC
      ) e
      WHERE (${isAdmin ? 1 : 0} = 1 OR v.EnfermeiraCodUsu = ${userId})
        AND v.Status IN (N'PENDENTE', N'CONFIRMADA', N'EM_ATENDIMENTO')
        AND v.DataHora >= DATEADD(day, -7, SYSUTCDATETIME())
        AND v.DataHora < DATEADD(day, 30, SYSUTCDATETIME())
      ORDER BY v.DataHora ASC
    `

    const planReviewsPromise = prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT p.CodCli, p.RevisarEm, COALESCE(c.Cliente, c.Razao) AS NomePaciente,
        s.Usuario AS Enfermeira
      FROM AtendimentoClinicoPlanoCuidado p
      INNER JOIN (
        SELECT CodCli, MAX(PlanoId) AS PlanoId
        FROM AtendimentoClinicoPlanoCuidado GROUP BY CodCli
      ) latest ON latest.PlanoId = p.PlanoId
      LEFT JOIN CLIENTEs c ON c.CodCli = p.CodCli
      LEFT JOIN Senha s ON s.CodUsu = p.EnfermeiraCodUsu
      WHERE p.RevisarEm IS NOT NULL
        AND p.RevisarEm <= DATEADD(day, 14, CAST(SYSUTCDATETIME() AS date))
        AND (${isAdmin ? 1 : 0} = 1 OR EXISTS (
          SELECT 1 FROM AtendimentoClinicoVisita v
          WHERE v.CodCli = p.CodCli AND v.EnfermeiraCodUsu = ${userId}
            AND v.Status NOT IN (N'REALIZADA', N'CANCELADA')
        ))
      ORDER BY p.RevisarEm ASC
    `

    const openIncidentsPromise = prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT TOP 100 i.IntercorrenciaId, i.CodCli, COALESCE(c.Cliente,c.Razao) AS NomePaciente,
        s.Usuario AS Enfermeira, i.Categoria, i.Gravidade, i.Status, i.DataHora
      FROM AtendimentoClinicoIntercorrencia i
      LEFT JOIN CLIENTEs c ON c.CodCli=i.CodCli
      LEFT JOIN Senha s ON s.CodUsu=i.EnfermeiraCodUsu
      WHERE i.Status<>N'RESOLVIDA' AND (${isAdmin ? 1 : 0}=1 OR i.EnfermeiraCodUsu=${userId})
      ORDER BY CASE i.Gravidade WHEN N'CRITICA' THEN 0 WHEN N'ALTA' THEN 1 WHEN N'MODERADA' THEN 2 ELSE 3 END, i.DataHora DESC
    `

    const savedDraftsPromise = prisma.$queryRaw<Array<Record<string, any>>>`
      SELECT TOP 100 r.RascunhoId, r.CodCli, r.VisitaId, r.AtualizadoEm,
        COALESCE(c.Cliente,c.Razao) AS NomePaciente, s.Usuario AS Enfermeira
      FROM AtendimentoClinicoRascunho r
      LEFT JOIN CLIENTEs c ON c.CodCli=r.CodCli
      LEFT JOIN Senha s ON s.CodUsu=r.EnfermeiraCodUsu
      WHERE (${isAdmin ? 1 : 0}=1 OR r.EnfermeiraCodUsu=${userId})
      ORDER BY r.AtualizadoEm DESC
    `

    const endingScalesPromise = prisma.$queryRaw<Array<Record<string, any>>>`
      ;WITH UltimosPlantoes AS (
        SELECT sh.Pedido, MAX(CAST(sh.Data AS date)) AS UltimoPlantao
        FROM Servico1 sh
        INNER JOIN Servico svInvalid ON svInvalid.Pedido = sh.Pedido AND svInvalid.DataSaida < svInvalid.DataInicio
        WHERE sh.Deletar IS NULL OR sh.Deletar <> N'S'
        GROUP BY sh.Pedido
      ), EscalasComFimProximo AS (
        SELECT sv.Pedido, sv.CodCli, sv.Responsavel,
          CASE WHEN sv.DataSaida < sv.DataInicio THEN up.UltimoPlantao ELSE CAST(sv.DataSaida AS date) END AS DataFim
        FROM Servico sv
        LEFT JOIN UltimosPlantoes up ON up.Pedido = sv.Pedido
        WHERE sv.DataInicio IS NOT NULL
          AND sv.DataInicio < DATEADD(day, 1, CAST(${today} AS date))
          AND (sv.Status IS NULL OR LTRIM(RTRIM(sv.Status)) IN (N'', N'ATIVO', N'ATIVA'))
          AND (COALESCE(sv.CodInd, 0) > 0 OR COALESCE(sv.CodInd2, 0) > 0 OR COALESCE(sv.CodInd3, 0) > 0
            OR EXISTS (SELECT 1 FROM Servico1 sh WHERE sh.Pedido = sv.Pedido
              AND (sh.Deletar IS NULL OR sh.Deletar <> N'S')
              AND (COALESCE(sh.CodInd, 0) > 0 OR COALESCE(sh.CodInd2, 0) > 0 OR COALESCE(sh.CodInd3, 0) > 0)))
          AND ((sv.DataSaida >= CAST(${today} AS date) AND sv.DataSaida < DATEADD(day, 31, CAST(${today} AS date)))
            OR (sv.DataSaida < sv.DataInicio AND up.UltimoPlantao >= CAST(${today} AS date)
              AND up.UltimoPlantao < DATEADD(day, 31, CAST(${today} AS date))))
      )
      SELECT TOP 100 c.CodCli, COALESCE(c.Cliente, c.Razao) AS NomePaciente, c.Bairro, c.Cidade,
        escala.Pedido, CONVERT(varchar(10), escala.DataFim, 23) AS DataFim, escala.Responsavel
      FROM EscalasComFimProximo escala
      INNER JOIN CLIENTEs c ON escala.CodCli = c.CodCli OR escala.CodCli = c.CodCli1
      INNER JOIN Segmento seg ON seg.CodSeg = c.CodSeg
      WHERE (UPPER(seg.Segmento) LIKE N'%PACIENTE%' OR UPPER(seg.Segmento) LIKE N'%IDOSO%' OR c.CodSeg = 2)
        AND (c.Situacao IS NULL OR LTRIM(RTRIM(c.Situacao)) IN (N'', N'A')) AND c.InativoDesde IS NULL
      ORDER BY escala.DataFim ASC
    `

    const [visits, planReviews, openIncidents, savedDrafts, endingScales] = await Promise.all([
      visitsPromise, planReviewsPromise, openIncidentsPromise, savedDraftsPromise, endingScalesPromise,
    ])

    const now = Date.now()
    const upcomingLimit = now + 24 * 60 * 60 * 1000
    const notifications = visits.flatMap(visit => {
      const timestamp = new Date(visit.DataHora).getTime()
      const date = new Date(visit.DataHora)
      const common = {
        visitId: Number(visit.VisitaId),
        patientId: Number(visit.CodCli),
        patientName: visit.NomePaciente || `Paciente ${visit.CodCli}`,
        nurseName: visit.Enfermeira || 'Equipe clínica',
        dataHora: visit.DataHora,
        date: brazilDateKey(date) || date.toISOString().slice(0, 10),
      }
      if (visit.Status === 'PENDENTE') return [{ ...common, id: `pending-${visit.VisitaId}`, type: 'confirmation', title: 'Visita aguardando confirmação', detail: 'Confirme ou reorganize esta visita.' }]
      if (visit.Status === 'EM_ATENDIMENTO' && now - timestamp > 2 * 60 * 60 * 1000 && !visit.EvolucaoId) return [{ ...common, id: `evolution-${visit.VisitaId}`, type: 'evolution', title: 'Evolução clínica pendente', detail: 'O atendimento está em andamento há mais de duas horas e ainda não tem evolução registrada.' }]
      if (visit.Status === 'CONFIRMADA' && timestamp < now && !visit.EvolucaoId) return [{ ...common, id: `evolution-${visit.VisitaId}`, type: 'evolution', title: 'Evolução clínica pendente', detail: 'A visita passou do horário e ainda não tem evolução registrada.' }]
      if (visit.Status === 'CONFIRMADA' && timestamp >= now && timestamp <= upcomingLimit) return [{ ...common, id: `upcoming-${visit.VisitaId}`, type: 'upcoming', title: 'Visita nas próximas 24 horas', detail: 'Confira o horário e os dados do paciente.' }]
      return []
    }).concat(planReviews.map(plan => {
      const reviewDate = new Date(plan.RevisarEm).toISOString().slice(0, 10)
      const overdue = new Date(`${reviewDate}T12:00:00`).getTime() < new Date(new Date().toDateString()).getTime()
      return {
        id: `care-plan-${plan.CodCli}-${reviewDate}`, visitId: 0, patientId: Number(plan.CodCli),
        patientName: plan.NomePaciente || `Paciente ${plan.CodCli}`, nurseName: plan.Enfermeira || 'Equipe clínica',
        dataHora: plan.RevisarEm, date: reviewDate, type: 'careplan',
        title: overdue ? 'Plano de cuidado precisa de revisão' : 'Revisão do plano de cuidado próxima',
        detail: overdue ? 'Atualize as orientações e os riscos registrados para este paciente.' : 'Confira se os objetivos, cuidados e sinais de alerta continuam atuais.',
      }
    })).concat(openIncidents.map(incident => ({
      id: `incident-${incident.IntercorrenciaId}`, visitId: Number(incident.VisitaId || 0), patientId: Number(incident.CodCli),
      patientName: incident.NomePaciente || `Paciente ${incident.CodCli}`, nurseName: incident.Enfermeira || 'Equipe clínica',
      dataHora: incident.DataHora, date: brazilDateKey(incident.DataHora) || new Date(incident.DataHora).toISOString().slice(0, 10),
      type: 'incident', title: `Intercorrência ${String(incident.Gravidade || '').toLowerCase()}`,
      detail: `${incident.Categoria} · ${incident.Status.replaceAll('_', ' ')}`,
    }))).concat(savedDrafts.map(draft => ({
      id: `draft-${draft.RascunhoId}`, visitId: Number(draft.VisitaId || 0), patientId: Number(draft.CodCli),
      patientName: draft.NomePaciente || `Paciente ${draft.CodCli}`, nurseName: draft.Enfermeira || 'Equipe clínica',
      dataHora: draft.AtualizadoEm, date: brazilDateKey(draft.AtualizadoEm) || new Date(draft.AtualizadoEm).toISOString().slice(0, 10),
      type: 'draft', title: 'Evolução salva como rascunho', detail: 'Retome e finalize o registro clínico protegido.',
    }))).concat(endingScales.map(scale => ({
      id: `scale-${scale.Pedido}-${scale.CodCli}`, visitId: 0, patientId: Number(scale.CodCli),
      patientName: scale.NomePaciente || `Paciente ${scale.CodCli}`, nurseName: scale.Responsavel || 'Equipe clínica',
      dataHora: `${scale.DataFim}T12:00:00`, date: String(scale.DataFim).slice(0, 10),
      type: 'scale', title: 'Escala próxima do encerramento', detail: `A escala termina em ${new Date(`${String(scale.DataFim).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}. Confirme a continuidade do atendimento.`,
    })))

    return NextResponse.json({ sucesso: true, notificacoes: notifications })
  } catch (error) {
    console.error('Falha ao carregar notificações clínicas', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar as notificações' }, { status: 500 })
  }
}
