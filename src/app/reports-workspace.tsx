'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Clock3, HeartHandshake, RefreshCw, Search, ShieldCheck, Star, UsersRound } from 'lucide-react'
import AuditWorkspace from './audit-workspace'

type ReportVisit = {
  VisitaId: number; CodCli: number; NomePaciente?: string; Idade?: number | null; Regiao?: string | null
  EnfermeiraCodUsu?: number; Enfermeira?: string; DataHora: string; Status: string; Satisfacao?: string | null; EscalaId?: string | null
  SatisfacaoMonitoramentoComunicacao?: number | null; SatisfacaoSuporteEnfermagem?: number | null
  SatisfacaoCuidadoresDia?: number | null; SatisfacaoCuidadoresNoite?: number | null
  SatisfacaoMonitoramentoSemana?: number | null; SatisfacaoMonitoramentoFimSemana?: number | null
  SatisfacaoEquipeManha?: number | null; SatisfacaoEquipeTarde?: number | null
}
type ReportData = {
  visitas: ReportVisit[]
  enfermeiras: { id: number; nome: string }[]
  aderencia?: { mes: string; enfermeiraId: number; enfermeira: string; escalaId: string; previstas: number; realizadas: number; percentual: number }[]
  alertasSatisfacao?: { VisitaId: number; CodCli: number; NomePaciente?: string; Enfermeira?: string; DataHora: string; menorNota: number }[]
  resumo: { total: number; realizadas: number; pendentes: number; comSatisfacao: number; taxaRespostaSatisfacao?: number | null; tendenciaMensal?: { mes: string; visitas: number; respostas: number; media: number | null }[]; mediaGeralSatisfacao?: number | null; mediasSatisfacao: Record<string, number | null>; quantidadeAvaliacoes?: Record<string, number> }
}

const blank: ReportData = { visitas: [], enfermeiras: [], aderencia: [], alertasSatisfacao: [], resumo: { total: 0, realizadas: 0, pendentes: 0, comSatisfacao: 0, mediasSatisfacao: {} } }
const ratings = [
  ['SatisfacaoMonitoramentoComunicacao', 'Monitoramento & Comunicação'],
  ['SatisfacaoSuporteEnfermagem', 'Suporte da Enfermagem'],
  ['SatisfacaoCuidadoresDia', 'Cuidadores · dia'],
  ['SatisfacaoCuidadoresNoite', 'Cuidadores · noite'],
] as const
const legacyRatings = [
  ['SatisfacaoMonitoramentoSemana', 'Monitoramento · dia de semana'],
  ['SatisfacaoMonitoramentoFimSemana', 'Monitoramento · fim de semana'],
  ['SatisfacaoEquipeManha', 'Equipe · manhã'],
  ['SatisfacaoEquipeTarde', 'Equipe · tarde'],
] as const
const ratingSummaryKeys = {
  SatisfacaoMonitoramentoComunicacao: 'monitoramentoComunicacao',
  SatisfacaoSuporteEnfermagem: 'suporteEnfermagem',
  SatisfacaoCuidadoresDia: 'cuidadoresDia',
  SatisfacaoCuidadoresNoite: 'cuidadoresNoite',
} as const
const statusNames: Record<string, string> = { PENDENTE: 'Pendente', CONFIRMADA: 'Confirmada', EM_ATENDIMENTO: 'Em atendimento', REALIZADA: 'Realizada', CANCELADA: 'Cancelada' }

export default function ReportsWorkspace() {
  const [data, setData] = useState<ReportData>(blank)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [section, setSection] = useState<'atendimentos' | 'satisfacao' | 'auditoria'>('atendimentos')
  const [period, setPeriod] = useState<'mensal' | 'trimestral' | 'anual'>('mensal')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [filters, setFilters] = useState({ dataInicio: '', dataFim: '', enfermeira: '', buscaIdoso: '', idadeMin: '', idadeMax: '', regiao: '', status: '' })
  const periodRange = useMemo(() => {
    const startMonth = period === 'anual' ? 0 : period === 'trimestral' ? (quarter - 1) * 3 : month - 1
    const monthCount = period === 'anual' ? 12 : period === 'trimestral' ? 3 : 1
    const start = new Date(year, startMonth, 1)
    const end = new Date(year, startMonth + monthCount, 0)
    const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { start: toDateKey(start), end: toDateKey(end) }
  }, [period, year, month, quarter])
  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (section === 'satisfacao' && (key === 'dataInicio' || key === 'dataFim')) return
      if (value.trim()) params.set(key, value.trim())
    })
    if (section === 'satisfacao') {
      params.set('dataInicio', periodRange.start)
      params.set('dataFim', periodRange.end)
    }
    return params.toString()
  }, [filters, section, periodRange])

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const response = await fetch(`/api/atendimento-clinico/relatorios${query ? `?${query}` : ''}`, { cache: 'no-store' })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.mensagem || 'Não foi possível carregar o relatório.')
        if (!live) return
        setData(result)
        setUpdatedAt(new Date())
        setError('')
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o relatório.')
      } finally {
        if (live) setLoading(false)
      }
    }
    setLoading(true)
    void load()
    const interval = window.setInterval(load, 30_000)
    return () => { live = false; window.clearInterval(interval) }
  }, [query, refreshKey])

  const resetFilters = () => setFilters({ dataInicio: '', dataFim: '', enfermeira: '', buscaIdoso: '', idadeMin: '', idadeMax: '', regiao: '', status: '' })
  const averages = data.resumo.mediasSatisfacao || {}
  const feedbacks = data.visitas.filter(visit => [...ratings, ...legacyRatings].some(([field]) => Number(visit[field]) > 0) || String(visit.Satisfacao || '').trim())
  const periodLabel = period === 'anual' ? String(year) : period === 'trimestral' ? `${quarter}º trimestre de ${year}` : `${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1, 1))} de ${year}`
  const exportSatisfaction = () => {
    const headers = ['Data', 'Horário', 'Idoso', 'Idade', 'Região', 'Escala', 'Enfermeira', 'Status da visita', ...ratings.map(([, label]) => label), ...legacyRatings.map(([, label]) => `Anterior · ${label}`), 'Comentário do contratante']
    const lines = feedbacks.map(visit => [
      new Date(visit.DataHora).toLocaleDateString('pt-BR'), new Date(visit.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), visit.NomePaciente || `Idoso #${visit.CodCli}`, visit.Idade ?? '', visit.Regiao || '', visit.EscalaId || '', visit.Enfermeira || '', statusNames[visit.Status] || visit.Status,
      visit.SatisfacaoMonitoramentoComunicacao ?? '', visit.SatisfacaoSuporteEnfermagem ?? '', visit.SatisfacaoCuidadoresDia ?? '', visit.SatisfacaoCuidadoresNoite ?? '', visit.SatisfacaoMonitoramentoSemana ?? '', visit.SatisfacaoMonitoramentoFimSemana ?? '', visit.SatisfacaoEquipeManha ?? '', visit.SatisfacaoEquipeTarde ?? '', visit.Satisfacao || '',
    ])
    const csv = [headers, ...lines].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `satisfacao-contratante-${period}-${periodRange.start}-${periodRange.end}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className="report-workspace">
    <div className="page-heading"><div><span className="eyebrow">GESTÃO DO CUIDADO</span><h1>Relatórios clínicos</h1><p>Visitas de todas as enfermeiras autorizadas e satisfação registrada pelos contratantes.</p></div><button className="secondary" onClick={() => setRefreshKey(value => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'spin-icon' : ''} />Atualizar</button></div>

    {error && <div className="report-error" role="alert">{error}</div>}

    <nav className="report-subnav" aria-label="Tipo de relatório">
      <button className={section === 'atendimentos' ? 'active' : ''} onClick={() => setSection('atendimentos')}><CalendarDays size={16} /><span className="subnav-full">Atendimento geral</span><span className="subnav-short">Atendimentos</span></button>
      <button className={section === 'satisfacao' ? 'active' : ''} onClick={() => setSection('satisfacao')}><Star size={16} /><span className="subnav-full">Satisfação do contratante</span><span className="subnav-short">Satisfação</span></button>
      <button className={section === 'auditoria' ? 'active' : ''} onClick={() => setSection('auditoria')}><ShieldCheck size={16} /><span className="subnav-full">Auditoria</span><span className="subnav-short">Auditoria</span></button>
    </nav>

    {section === 'atendimentos' && <><div className="report-stats">
      <article className="report-stat"><span className="report-stat-icon lavender"><CalendarDays size={18} /></span><div><small>ATENDIMENTOS</small><strong>{data.resumo.total}</strong></div></article>
      <article className="report-stat"><span className="report-stat-icon mint"><HeartHandshake size={18} /></span><div><small>REALIZADOS</small><strong>{data.resumo.realizadas}</strong></div></article>
      <article className="report-stat"><span className="report-stat-icon peach"><Clock3 size={18} /></span><div><small>EM ABERTO</small><strong>{data.resumo.pendentes}</strong></div></article>
      <article className="report-stat"><span className="report-stat-icon rose"><Star size={18} /></span><div><small>COM SATISFAÇÃO</small><strong>{data.resumo.comSatisfacao}</strong></div></article>
    </div>

    <section className="panel report-table-panel adherence-panel"><div className="report-section-heading"><div><h2>Aderência das visitas por enfermeira e escala</h2><p>Realizadas sobre visitas agendadas no recorte de datas aplicado. Canceladas ficam fora do cálculo.</p></div><span className="report-count"><Activity size={14} />{data.aderencia?.length || 0} grupos mensais</span></div><div className="report-table-scroll"><table className="report-table"><thead><tr><th>Mês</th><th>Enfermeira</th><th>Escala</th><th>Previstas</th><th>Realizadas</th><th>Aderência</th></tr></thead><tbody>{(data.aderencia || []).map((item, index) => <tr key={`${item.mes}-${item.enfermeiraId}-${item.escalaId}-${index}`}><td>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${item.mes}-01T12:00:00`))}</td><td>{item.enfermeira}</td><td>{item.escalaId === 'Sem escala identificada' ? 'Sem escala identificada' : `#${item.escalaId}`}</td><td>{item.previstas}</td><td>{item.realizadas}</td><td><strong className="adherence-rate">{item.percentual}%</strong></td></tr>)}{!loading && !(data.aderencia || []).length && <tr><td colSpan={6} className="report-no-results">Não há visitas previstas no recorte selecionado.</td></tr>}</tbody></table></div></section>

    <section className="panel report-filters"><div className="report-section-heading"><div><h2>Atendimento geral</h2><p>Combine os filtros para refinar os resultados.</p></div><button className="text-action" onClick={resetFilters}>Limpar filtros</button></div>
      <div className="report-filter-grid">
        <label className="input-field"><span>Data inicial</span><input type="date" value={filters.dataInicio} onChange={e => setFilters({ ...filters, dataInicio: e.target.value })} /></label>
        <label className="input-field"><span>Data final</span><input type="date" value={filters.dataFim} onChange={e => setFilters({ ...filters, dataFim: e.target.value })} /></label>
        <label className="input-field"><span>Enfermeira habilitada</span><div className="select-wrap"><select value={filters.enfermeira} onChange={e => setFilters({ ...filters, enfermeira: e.target.value })}><option value="">Todas as enfermeiras</option>{data.enfermeiras.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div></label>
        <label className="input-field"><span>Idoso</span><div className="report-search"><Search size={15} /><input value={filters.buscaIdoso} onChange={e => setFilters({ ...filters, buscaIdoso: e.target.value })} placeholder="Nome ou código" /></div></label>
        <label className="input-field"><span>Idade mínima</span><input type="number" min="0" max="125" value={filters.idadeMin} onChange={e => setFilters({ ...filters, idadeMin: e.target.value })} placeholder="Qualquer" /></label>
        <label className="input-field"><span>Idade máxima</span><input type="number" min="0" max="125" value={filters.idadeMax} onChange={e => setFilters({ ...filters, idadeMax: e.target.value })} placeholder="Qualquer" /></label>
        <label className="input-field"><span>Região</span><div className="select-wrap"><select value={filters.regiao} onChange={e => setFilters({ ...filters, regiao: e.target.value })}><option value="">Todas as regiões</option><option value="SALVADOR">Salvador</option><option value="LAURO DE FREITAS">Lauro de Freitas</option></select></div></label>
        <label className="input-field"><span>Status do atendimento</span><div className="select-wrap"><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Todos os status</option><option value="PENDENTE">Pendente</option><option value="CONFIRMADA">Confirmada</option><option value="EM_ATENDIMENTO">Em atendimento</option><option value="REALIZADA">Realizada</option><option value="CANCELADA">Cancelada</option></select></div></label>
      </div>
    </section>

      <section className="panel report-table-panel"><div className="report-section-heading"><div><h2>Visitas encontradas</h2><p>{data.visitas.length} registros com os filtros selecionados.</p></div><span className="report-count"><UsersRound size={15} />{data.visitas.length}</span></div>
      <div className="report-table-scroll"><table className="report-table"><thead><tr><th>Data</th><th>Idoso</th><th>Idade</th><th>Região</th><th>Escala</th><th>Enfermeira</th><th>Status</th><th>Satisfação</th></tr></thead><tbody>
        {data.visitas.map(visit => {
          const scores = ratings.map(([field]) => visit[field]).filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 1 && score <= 5)
          const previousScores = legacyRatings.map(([field]) => visit[field]).filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 1 && score <= 5)
          const usingLegacy = scores.length === 0 && previousScores.length > 0
          const shownScores = usingLegacy ? previousScores : scores
          const avg = shownScores.length ? (shownScores.reduce((sum, value) => sum + Number(value), 0) / shownScores.length).toFixed(1) : null
          return <tr key={visit.VisitaId}><td><strong>{new Date(visit.DataHora).toLocaleDateString('pt-BR')}</strong><small>{new Date(visit.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></td><td><strong>{visit.NomePaciente || `Idoso #${visit.CodCli}`}</strong><small>#{visit.CodCli}</small></td><td>{visit.Idade ?? '—'}</td><td>{visit.Regiao || '—'}</td><td>{visit.EscalaId ? `#${visit.EscalaId}` : '—'}</td><td>{visit.Enfermeira || `Profissional #${visit.EnfermeiraCodUsu || ''}`}</td><td><span className={`report-status ${String(visit.Status || '').toLowerCase()}`}>{statusNames[visit.Status] || visit.Status}</span></td><td><div className="report-rating">{avg ? <><Star size={14} fill="currentColor" />{avg} / 5</> : 'Pendente'}</div>{usingLegacy && <small>Formulário anterior</small>}{visit.Satisfacao && <small className="satisfaction-comment" title={visit.Satisfacao}>{visit.Satisfacao}</small>}</td></tr>
        })}
        {!loading && data.visitas.length === 0 && <tr><td colSpan={8} className="report-no-results">Nenhum atendimento encontrado para esses filtros.</td></tr>}
      </tbody></table></div>
    </section>
    </>}

    {section === 'satisfacao' && <>
      <section className="panel report-satisfaction"><div className="report-section-heading"><div><span className="eyebrow">FECHAMENTO DE SATISFAÇÃO</span><h2>Satisfação do contratante</h2><p>Período: {periodLabel}. Consolidação ao vivo das avaliações registradas.</p></div><span className="live-indicator"><span className="online-dot" /> Atualiza a cada 30 segundos</span></div>
        <div className="report-print-heading"><img src="/logo01.svg" alt="Cuida Amor" /><div><h1>Relatório de satisfação · Cuida Amor</h1><p>{periodLabel} · Gerado em {new Date().toLocaleDateString('pt-BR')}</p></div></div>
        <div className="satisfaction-period"><div className="period-options" role="group" aria-label="Período do relatório">{(['mensal','trimestral','anual'] as const).map(value => <button className={period === value ? 'active' : ''} key={value} onClick={() => setPeriod(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div><label className="period-select"><span>Ano</span><input type="number" min="2000" max="2100" value={year} onChange={event => setYear(Number(event.target.value))} /></label>{period === 'mensal' && <label className="period-select"><span>Mês</span><select value={month} onChange={event => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, index, 1))}</option>)}</select></label>}{period === 'trimestral' && <label className="period-select"><span>Trimestre</span><select value={quarter} onChange={event => setQuarter(Number(event.target.value))}><option value={1}>1º trimestre · jan–mar</option><option value={2}>2º trimestre · abr–jun</option><option value={3}>3º trimestre · jul–set</option><option value={4}>4º trimestre · out–dez</option></select></label>}<button className="secondary" onClick={exportSatisfaction} disabled={!feedbacks.length}>Exportar CSV</button><button className="secondary" onClick={() => window.print()}>Imprimir / PDF</button></div>
        <div className="report-stats satisfaction-stats"><article className="report-stat"><span className="report-stat-icon rose"><Star size={18} /></span><div><small>FORMULÁRIOS RESPONDIDOS</small><strong>{data.resumo.comSatisfacao}</strong></div></article><article className="report-stat"><span className="report-stat-icon lavender"><HeartHandshake size={18} /></span><div><small>CONTRATANTES COM COMENTÁRIO</small><strong>{data.visitas.filter(visit => String(visit.Satisfacao || '').trim()).length}</strong></div></article><article className="report-stat"><span className="report-stat-icon mint"><CalendarDays size={18} /></span><div><small>VISITAS NO PERÍODO</small><strong>{data.resumo.total}</strong></div></article><article className="report-stat"><span className="report-stat-icon peach"><Star size={18} /></span><div><small>MÉDIA GERAL</small><strong>{data.resumo.mediaGeralSatisfacao ?? '—'}{data.resumo.mediaGeralSatisfacao !== null && data.resumo.mediaGeralSatisfacao !== undefined && <small className="score-scale"> / 5</small>}</strong></div></article><article className="report-stat"><span className="report-stat-icon lavender"><Activity size={18} /></span><div><small>TAXA DE RESPOSTA</small><strong>{data.resumo.taxaRespostaSatisfacao === null || data.resumo.taxaRespostaSatisfacao === undefined ? '—' : `${data.resumo.taxaRespostaSatisfacao}%`}</strong></div></article></div>
        <section className="low-rating-panel" aria-label="Avaliações que precisam de acompanhamento"><div><strong>Retorno preventivo</strong><span>Avaliações com nota até 3 em pelo menos uma categoria</span></div>{(data.alertasSatisfacao || []).length ? <div className="low-rating-list">{data.alertasSatisfacao!.slice(0, 12).map(item => <article key={item.VisitaId}><Star size={14} fill="currentColor" /><strong>{item.NomePaciente || `Idoso #${item.CodCli}`}</strong><span>Nota mais baixa: {item.menorNota}/5 · {item.Enfermeira || 'Equipe clínica'}</span><time>{new Date(item.DataHora).toLocaleDateString('pt-BR')}</time></article>)}</div> : <p>Nenhuma avaliação neste período exige retorno preventivo.</p>}</section>
        <div className="rating-summary">{ratings.map(([field, label]) => { const key = ratingSummaryKeys[field]; return <div className="rating-summary-item" key={field}><span>{label}</span><strong>{averages[key] ?? '—'}<small>{averages[key] === null ? '' : ' / 5'}</small></strong><div className="rating-stars" aria-label={averages[key] === null ? 'Sem avaliações' : `${averages[key]} de 5`}>{Array.from({ length: 5 }, (_, starIndex) => <Star key={starIndex} size={13} fill={Number(averages[key] || 0) >= starIndex + 1 ? 'currentColor' : 'none'} />)}</div><small className="rating-response-count">{data.resumo.quantidadeAvaliacoes?.[key] || 0} avaliações</small></div>})}</div>
        <section className="satisfaction-trend"><div><h3>Evolução mensal</h3><p>Média das notas registradas e quantidade de respostas em cada mês.</p></div>{(data.resumo.tendenciaMensal || []).length ? <div className="trend-bars">{data.resumo.tendenciaMensal!.map(item => <div className="trend-month" key={item.mes} aria-label={`${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${item.mes}-01T12:00:00`))}: média ${item.media ?? 'sem notas'} de 5, ${item.respostas} respostas`}><div className="trend-bar-track"><span className="trend-bar" style={{ height: `${Math.max(item.media ? item.media / 5 * 100 : 0, 3)}%` }} /></div><strong>{item.media ?? '—'}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.mes}-01T12:00:00`))}</span><small>{item.respostas} resp.</small></div>)}</div> : <div className="trend-empty">Ainda não há avaliações neste período.</div>}</section>
        <p className="report-updated"><Activity size={14} />{updatedAt ? `Última atualização às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Carregando dados atuais'}</p>
      </section>
      <section className="panel report-filters"><div className="report-section-heading"><div><h2>Refinar o fechamento</h2><p>Combine os critérios com o período escolhido.</p></div><button className="text-action" onClick={resetFilters}>Limpar filtros adicionais</button></div><div className="report-filter-grid"><label className="input-field"><span>Enfermeira habilitada</span><div className="select-wrap"><select value={filters.enfermeira} onChange={e => setFilters({ ...filters, enfermeira: e.target.value })}><option value="">Todas as enfermeiras</option>{data.enfermeiras.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div></label><label className="input-field"><span>Idoso</span><div className="report-search"><Search size={15} /><input value={filters.buscaIdoso} onChange={e => setFilters({ ...filters, buscaIdoso: e.target.value })} placeholder="Nome ou código" /></div></label><label className="input-field"><span>Idade mínima</span><input type="number" min="0" max="125" value={filters.idadeMin} onChange={e => setFilters({ ...filters, idadeMin: e.target.value })} placeholder="Qualquer" /></label><label className="input-field"><span>Idade máxima</span><input type="number" min="0" max="125" value={filters.idadeMax} onChange={e => setFilters({ ...filters, idadeMax: e.target.value })} placeholder="Qualquer" /></label><label className="input-field"><span>Região</span><div className="select-wrap"><select value={filters.regiao} onChange={e => setFilters({ ...filters, regiao: e.target.value })}><option value="">Todas as regiões</option><option value="SALVADOR">Salvador</option><option value="LAURO DE FREITAS">Lauro de Freitas</option></select></div></label></div></section>
      <section className="panel report-table-panel"><div className="report-section-heading"><div><h2>Respostas no período</h2><p>{feedbacks.length} avaliações detalhadas · {periodLabel}</p></div><span className="report-count"><Star size={14} />{feedbacks.length}</span></div><div className="report-table-scroll"><table className="report-table satisfaction-table"><thead><tr><th>Data / hora</th><th>Idoso</th><th>Idade / região</th><th>Enfermeira</th><th>Monitoramento & Comunicação</th><th>Suporte da Enfermagem</th><th>Cuidadores · dia</th><th>Cuidadores · noite</th><th>Comentário do contratante</th></tr></thead><tbody>{feedbacks.map(visit => <tr key={visit.VisitaId}><td>{new Date(visit.DataHora).toLocaleDateString('pt-BR')}<small>{new Date(visit.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {statusNames[visit.Status] || visit.Status}</small></td><td><strong>{visit.NomePaciente || `Idoso #${visit.CodCli}`}</strong><small>#{visit.CodCli}</small></td><td>{visit.Idade ?? '—'} anos<small>{visit.Regiao || 'Região não informada'}</small></td><td>{visit.Enfermeira || '—'}</td>{ratings.map(([field]) => <td key={field}>{visit[field] ? <span className="report-rating"><Star size={13} fill="currentColor" />{visit[field]} / 5</span> : '—'}</td>)}<td><span className="satisfaction-comment" title={visit.Satisfacao || ''}>{visit.Satisfacao || 'Sem comentário'}</span>{legacyRatings.some(([field]) => Number(visit[field]) >= 1) && <small className="legacy-ratings-summary">Formulário anterior · {legacyRatings.filter(([field]) => Number(visit[field]) >= 1).map(([field, label]) => `${label}: ${visit[field]}/5`).join(' · ')}</small>}</td></tr>)}{!loading && !feedbacks.length && <tr><td colSpan={9} className="report-no-results">Nenhuma resposta de satisfação neste período.</td></tr>}</tbody></table></div></section>
    </>}
    {section === 'auditoria' && <AuditWorkspace />}
  </div>
}
