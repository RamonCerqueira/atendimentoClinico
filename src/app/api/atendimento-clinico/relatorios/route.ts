import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/client'
import { prisma } from '@/lib/prisma'
import { ensureAtendimentoClinicoTables } from '@/lib/ensureAtendimentoClinicoTables'
import { hasPrivilegedAccess } from '@/lib/profileAccess'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ratingFields = [
  'SatisfacaoMonitoramentoComunicacao',
  'SatisfacaoSuporteEnfermagem',
  'SatisfacaoCuidadoresDia',
  'SatisfacaoCuidadoresNoite',
] as const
const legacyRatingFields = [
  'SatisfacaoMonitoramentoSemana',
  'SatisfacaoMonitoramentoFimSemana',
  'SatisfacaoEquipeManha',
  'SatisfacaoEquipeTarde',
] as const

export async function GET(request: NextRequest) {
  if (!hasPrivilegedAccess(request)) {
    return NextResponse.json({ sucesso: false, mensagem: 'Relatórios disponíveis apenas para a administração' }, { status: 403 })
  }

  try {
    await ensureAtendimentoClinicoTables()
    const params = request.nextUrl.searchParams
    const filters: Prisma.Sql[] = []
    const dateFrom = params.get('dataInicio')
    const dateTo = params.get('dataFim')
    const nurseId = Number(params.get('enfermeira'))
    const patientId = Number(params.get('idoso'))
    const patientSearch = String(params.get('buscaIdoso') || '').trim().slice(0, 100)
    const ageMinValue = params.get('idadeMin')
    const ageMaxValue = params.get('idadeMax')
    const ageMin = ageMinValue === null || ageMinValue === '' ? Number.NaN : Number(ageMinValue)
    const ageMax = ageMaxValue === null || ageMaxValue === '' ? Number.NaN : Number(ageMaxValue)
    const region = String(params.get('regiao') || '').trim().toUpperCase()
    const status = String(params.get('status') || '').trim().toUpperCase()

    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) filters.push(Prisma.sql`v.DataHora >= CAST(${dateFrom} AS date)`)
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) filters.push(Prisma.sql`v.DataHora < DATEADD(day, 1, CAST(${dateTo} AS date))`)
    if (Number.isInteger(nurseId) && nurseId > 0) filters.push(Prisma.sql`v.EnfermeiraCodUsu = ${nurseId}`)
    if (Number.isInteger(patientId) && patientId > 0) filters.push(Prisma.sql`v.CodCli = ${patientId}`)
    if (patientSearch) {
      const numericId = Number(patientSearch.replace(/^#/, ''))
      filters.push(Number.isInteger(numericId) && numericId > 0
        ? Prisma.sql`(c.Cliente LIKE ${`%${patientSearch}%`} OR c.Razao LIKE ${`%${patientSearch}%`} OR v.CodCli = ${numericId})`
        : Prisma.sql`(c.Cliente LIKE ${`%${patientSearch}%`} OR c.Razao LIKE ${`%${patientSearch}%`})`)
    }
    if (Number.isInteger(ageMin) && ageMin >= 0) filters.push(Prisma.sql`DATEDIFF(YEAR, dn.DataNascimento, CAST(v.DataHora AS date)) - CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, dn.DataNascimento, CAST(v.DataHora AS date)), dn.DataNascimento) > CAST(v.DataHora AS date) THEN 1 ELSE 0 END >= ${ageMin}`)
    if (Number.isInteger(ageMax) && ageMax >= 0) filters.push(Prisma.sql`DATEDIFF(YEAR, dn.DataNascimento, CAST(v.DataHora AS date)) - CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, dn.DataNascimento, CAST(v.DataHora AS date)), dn.DataNascimento) > CAST(v.DataHora AS date) THEN 1 ELSE 0 END <= ${ageMax}`)
    if (region === 'SALVADOR') filters.push(Prisma.sql`UPPER(LTRIM(RTRIM(c.Cidade))) LIKE N'%SALVADOR%'`)
    if (region === 'LAURO DE FREITAS') filters.push(Prisma.sql`UPPER(LTRIM(RTRIM(c.Cidade))) LIKE N'%LAURO DE FREITAS%'`)
    if (status && ['PENDENTE', 'CONFIRMADA', 'EM_ATENDIMENTO', 'REALIZADA', 'CANCELADA'].includes(status)) filters.push(Prisma.sql`v.Status = ${status}`)

    const whereClause = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty
    const visits = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT v.VisitaId, v.CodCli, COALESCE(c.Cliente, c.Razao) AS NomePaciente,
        c.Bairro, c.Cidade AS Regiao, dn.DataNascimento,
        CASE WHEN dn.DataNascimento IS NULL THEN NULL ELSE
          DATEDIFF(YEAR, dn.DataNascimento, CAST(v.DataHora AS date)) -
          CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, dn.DataNascimento, CAST(v.DataHora AS date)), dn.DataNascimento) > CAST(v.DataHora AS date) THEN 1 ELSE 0 END
        END AS Idade,
        v.EnfermeiraCodUsu, s.Usuario AS Enfermeira, v.DataHora, v.Status, sc.EscalaId,
        ev.EvolucaoId, ev.Satisfacao,
        ev.SatisfacaoMonitoramentoComunicacao, ev.SatisfacaoSuporteEnfermagem,
        ev.SatisfacaoCuidadoresDia, ev.SatisfacaoCuidadoresNoite,
        ev.SatisfacaoMonitoramentoSemana, ev.SatisfacaoMonitoramentoFimSemana,
        ev.SatisfacaoEquipeManha, ev.SatisfacaoEquipeTarde
      FROM AtendimentoClinicoVisita v
      LEFT JOIN CLIENTEs c ON c.CodCli = v.CodCli
      LEFT JOIN Senha s ON s.CodUsu = v.EnfermeiraCodUsu
      OUTER APPLY (
        SELECT TOP 1 CAST(sv.Pedido AS nvarchar(50)) AS EscalaId
        FROM Servico sv
        WHERE sv.Codcli IN (c.CodCli, c.CodCli1)
          AND sv.DataInicio IS NOT NULL AND CAST(sv.DataInicio AS date) <= CAST(v.DataHora AS date)
          AND (sv.Status IS NULL OR LTRIM(RTRIM(sv.Status)) IN (N'', N'ATIVO', N'ATIVA'))
          AND (
            sv.DataSaida IS NULL OR CAST(sv.DataSaida AS date) >= CAST(v.DataHora AS date)
            OR (sv.DataSaida < sv.DataInicio AND CAST(v.DataHora AS date) <= (
              SELECT MAX(CAST(sh.Data AS date)) FROM Servico1 sh
              WHERE sh.Pedido = sv.Pedido AND (sh.Deletar IS NULL OR sh.Deletar <> N'S')
            ))
          )
          AND (
            COALESCE(sv.CodInd, 0) > 0 OR COALESCE(sv.CodInd2, 0) > 0 OR COALESCE(sv.CodInd3, 0) > 0
            OR EXISTS (SELECT 1 FROM Servico1 sh WHERE sh.Pedido = sv.Pedido AND (sh.Deletar IS NULL OR sh.Deletar <> N'S')
              AND (COALESCE(sh.CodInd, 0) > 0 OR COALESCE(sh.CodInd2, 0) > 0 OR COALESCE(sh.CodInd3, 0) > 0))
          )
        ORDER BY sv.DataInicio DESC, sv.Pedido DESC
      ) sc
      OUTER APPLY (
        SELECT TRY_CONVERT(date, CONCAT(c.Ano_Nasc, '-', RIGHT('0' + CAST(c.Mes_Nasc AS varchar(2)), 2), '-', RIGHT('0' + CAST(c.Dia_Nasc AS varchar(2)), 2)), 23) AS DataNascimento
      ) dn
      OUTER APPLY (
        SELECT TOP 1 e.EvolucaoId, e.Satisfacao, e.SatisfacaoMonitoramentoComunicacao,
          e.SatisfacaoSuporteEnfermagem, e.SatisfacaoCuidadoresDia, e.SatisfacaoCuidadoresNoite,
          e.SatisfacaoMonitoramentoSemana, e.SatisfacaoMonitoramentoFimSemana,
          e.SatisfacaoEquipeManha, e.SatisfacaoEquipeTarde
        FROM AtendimentoClinicoEvolucao e
        WHERE e.VisitaId = v.VisitaId OR (e.VisitaId IS NULL AND e.CodCli = v.CodCli
          AND e.EnfermeiraCodUsu = v.EnfermeiraCodUsu AND CAST(e.DataHora AS date) = CAST(v.DataHora AS date))
        ORDER BY e.DataHora DESC
      ) ev
      ${whereClause}
      ORDER BY v.DataHora DESC, v.VisitaId DESC
    `)
    const enfermeiras = await prisma.$queryRaw<Array<{ CodUsu: number; Usuario: string | null }>>`
      SELECT CodUsu, Usuario FROM Senha
      WHERE LTRIM(RTRIM(ISNULL(Perfil, ''))) = '6' AND AtendimentoClinico = 1
      ORDER BY Usuario
    `
    const media = (field: typeof ratingFields[number]) => {
      const values = visits.map(row => Number(row[field])).filter(value => Number.isFinite(value) && value >= 1 && value <= 5)
      return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : null
    }
    const countRatings = (field: typeof ratingFields[number]) => visits.filter(row => Number(row[field]) >= 1 && Number(row[field]) <= 5).length
    const allRatings: number[] = []
    visits.forEach(row => {
      for (const ratingField of ratingFields) {
        const value = Number(row[ratingField])
        if (Number.isFinite(value) && value >= 1 && value <= 5) allRatings.push(value)
      }
    })
    const completedCount = visits.filter(row => row.Status === 'REALIZADA').length
    const allRatingFields = [...ratingFields, ...legacyRatingFields]
    const hasSatisfaction = (row: Record<string, any>) => allRatingFields.some(field => Number(row[field]) >= 1 && Number(row[field]) <= 5) || Boolean(String(row.Satisfacao || '').trim())
    const satisfactionCount = visits.filter(hasSatisfaction).length
    const completedSatisfactionCount = visits.filter(row => row.Status === 'REALIZADA' && hasSatisfaction(row)).length
    const monthly = new Map<string, { visitas: number; respostas: number; ratings: number[] }>()
    const monthKey = (value: Date | string) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date(value))
    for (const row of visits) {
      const key = monthKey(row.DataHora)
      const item = monthly.get(key) || { visitas: 0, respostas: 0, ratings: [] }
      item.visitas += 1
      const scores = ratingFields.map(field => Number(row[field])).filter(value => Number.isFinite(value) && value >= 1 && value <= 5)
      if (allRatingFields.some(field => Number(row[field]) >= 1 && Number(row[field]) <= 5) || String(row.Satisfacao || '').trim()) item.respostas += 1
      item.ratings.push(...scores)
      monthly.set(key, item)
    }
    const tendenciaMensal = Array.from(monthly, ([mes, item]) => ({
      mes,
      visitas: item.visitas,
      respostas: item.respostas,
      media: item.ratings.length ? Number((item.ratings.reduce((sum, value) => sum + value, 0) / item.ratings.length).toFixed(1)) : null,
    })).sort((a, b) => a.mes.localeCompare(b.mes))

    const adherenceGroups = new Map<string, { mes: string; enfermeiraId: number; enfermeira: string; escalaId: string; previstas: number; realizadas: number }>()
    for (const row of visits) {
      if (row.Status === 'CANCELADA') continue
      const mes = monthKey(row.DataHora)
      const enfermeiraId = Number(row.EnfermeiraCodUsu)
      const escalaId = String(row.EscalaId || 'Sem escala identificada')
      const key = `${mes}:${enfermeiraId}:${escalaId}`
      const group = adherenceGroups.get(key) || { mes, enfermeiraId, enfermeira: String(row.Enfermeira || `Profissional #${enfermeiraId}`), escalaId, previstas: 0, realizadas: 0 }
      group.previstas += 1
      if (row.Status === 'REALIZADA') group.realizadas += 1
      adherenceGroups.set(key, group)
    }
    const aderencia = Array.from(adherenceGroups.values()).map(group => ({ ...group, percentual: group.previstas ? Number((group.realizadas * 100 / group.previstas).toFixed(1)) : 0 }))
    const lowSatisfaction = visits.flatMap(row => {
      const scores = allRatingFields.map(field => Number(row[field])).filter(value => Number.isFinite(value) && value >= 1 && value <= 5)
      if (!scores.length || Math.min(...scores) > 3) return []
      return [{ VisitaId: row.VisitaId, CodCli: row.CodCli, NomePaciente: row.NomePaciente, Enfermeira: row.Enfermeira, DataHora: row.DataHora, menorNota: Math.min(...scores) }]
    })

    return NextResponse.json({
      sucesso: true,
      visitas: visits,
      enfermeiras: enfermeiras.map(user => ({ id: user.CodUsu, nome: user.Usuario || `Usuário ${user.CodUsu}` })),
      aderencia,
      alertasSatisfacao: lowSatisfaction,
      resumo: {
        total: visits.length,
        realizadas: completedCount,
        pendentes: visits.filter(row => ['PENDENTE', 'CONFIRMADA', 'EM_ATENDIMENTO'].includes(row.Status)).length,
        comSatisfacao: satisfactionCount,
        taxaRespostaSatisfacao: completedCount ? Number((completedSatisfactionCount * 100 / completedCount).toFixed(1)) : null,
        tendenciaMensal,
        mediaGeralSatisfacao: allRatings.length ? Number((allRatings.reduce((sum, value) => sum + value, 0) / allRatings.length).toFixed(1)) : null,
        mediasSatisfacao: {
          monitoramentoComunicacao: media('SatisfacaoMonitoramentoComunicacao'),
          suporteEnfermagem: media('SatisfacaoSuporteEnfermagem'),
          cuidadoresDia: media('SatisfacaoCuidadoresDia'),
          cuidadoresNoite: media('SatisfacaoCuidadoresNoite'),
        },
        quantidadeAvaliacoes: {
          monitoramentoComunicacao: countRatings('SatisfacaoMonitoramentoComunicacao'),
          suporteEnfermagem: countRatings('SatisfacaoSuporteEnfermagem'),
          cuidadoresDia: countRatings('SatisfacaoCuidadoresDia'),
          cuidadoresNoite: countRatings('SatisfacaoCuidadoresNoite'),
        },
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Falha ao carregar relatórios clínicos', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar os relatórios clínicos' }, { status: 500 })
  }
}
