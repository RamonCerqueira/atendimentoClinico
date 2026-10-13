'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, ShieldCheck } from 'lucide-react'

type AuditRow = { AuditoriaId: number; CodUsu: number; Profissional: string; Acao: string; Entidade: string; EntidadeId?: string | null; CodCli?: number | null; NomePaciente?: string | null; Detalhes?: string | null; CriadoEm: string }
const today = () => new Date().toISOString().slice(0, 10)

export default function AuditWorkspace() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ inicio: '', fim: '', profissional: '', idoso: '', acao: '' })

  useEffect(() => {
    let current = true
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    setLoading(true)
    fetch(`/api/atendimento-clinico/auditoria${params.size ? `?${params}` : ''}`, { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.mensagem || 'Não foi possível carregar a auditoria.'); return data })
      .then(data => { if (current) { setRows(data.registros || []); setError('') } })
      .catch(caught => { if (current) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a auditoria.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters])

  function exportCsv() {
    const headers = ['Data e hora', 'Profissional', 'Ação', 'Entidade', 'Idoso', 'Detalhes']
    const values = rows.map(row => [new Date(row.CriadoEm).toLocaleString('pt-BR'), row.Profissional, row.Acao, row.Entidade, row.NomePaciente || (row.CodCli ? `Idoso #${row.CodCli}` : ''), row.Detalhes || ''])
    const csv = [headers, ...values].map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })); link.download = `auditoria-clinica-${today()}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="audit-workspace">
    <div className="report-section-heading"><div><h2><ShieldCheck size={18} /> Trilha de auditoria clínica</h2><p>Consultas ao prontuário e alterações realizadas no atendimento.</p></div><div className="audit-actions"><span>{rows.length} registros{rows.length === 500 ? ' · limite de 500' : ''}</span><button className="secondary" onClick={exportCsv} disabled={!rows.length}><Download size={15} />Exportar CSV</button><button className="secondary" onClick={() => setFilters({ ...filters })} disabled={loading}><RefreshCw size={15} />Atualizar</button></div></div>
    {error && <div className="report-error" role="alert">{error}</div>}
    <section className="panel report-filters"><div className="report-filter-grid audit-filters">
      <label className="input-field"><span>De</span><input type="date" value={filters.inicio} onChange={event => setFilters({ ...filters, inicio: event.target.value })} /></label>
      <label className="input-field"><span>Até</span><input type="date" value={filters.fim} onChange={event => setFilters({ ...filters, fim: event.target.value })} /></label>
      <label className="input-field"><span>Código do profissional</span><input inputMode="numeric" value={filters.profissional} onChange={event => setFilters({ ...filters, profissional: event.target.value.replace(/\D/g, '') })} placeholder="Todos" /></label>
      <label className="input-field"><span>Código do idoso</span><input inputMode="numeric" value={filters.idoso} onChange={event => setFilters({ ...filters, idoso: event.target.value.replace(/\D/g, '') })} placeholder="Todos" /></label>
      <label className="input-field"><span>Ação registrada</span><input value={filters.acao} onChange={event => setFilters({ ...filters, acao: event.target.value.toLocaleUpperCase('pt-BR').slice(0, 60) })} placeholder="Todas" /></label>
    </div></section>
    <section className="panel report-table-panel"><div className="report-table-scroll"><table className="report-table"><thead><tr><th>Data e hora</th><th>Profissional</th><th>Ação</th><th>Idoso</th><th>Detalhes</th></tr></thead><tbody>{rows.map(row => <tr key={row.AuditoriaId}><td>{new Date(row.CriadoEm).toLocaleString('pt-BR')}</td><td><strong>{row.Profissional}</strong><small>Código #{row.CodUsu}</small></td><td><span className="audit-action-tag">{row.Acao.split('_').join(' ').toLocaleLowerCase('pt-BR')}</span><small>{row.Entidade}{row.EntidadeId ? ` · ${row.EntidadeId}` : ''}</small></td><td>{row.NomePaciente || (row.CodCli ? `Idoso #${row.CodCli}` : '—')}</td><td>{row.Detalhes || '—'}</td></tr>)}{!loading && !rows.length && <tr><td colSpan={5} className="report-no-results">Nenhuma ação encontrada nesse período.</td></tr>}</tbody></table></div>{loading && <p className="audit-loading">Atualizando trilha de auditoria…</p>}</section>
  </div>
}
