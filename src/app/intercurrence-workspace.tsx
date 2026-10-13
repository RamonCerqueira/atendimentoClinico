'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Plus, Search, ShieldAlert, X } from 'lucide-react'

type PatientOption = { id: number; nome?: string; razao?: string; cpf_cnpj?: string | null; bairro?: string; data_nascimento?: string }
type Incident = { IntercorrenciaId: number; CodCli: number; NomePaciente?: string; Bairro?: string; Enfermeira?: string; Categoria: string; Gravidade: string; Relato: string; Conduta?: string; Encaminhamento?: string; Status: string; DataHora: string; ResolvidaEm?: string | null }
const categories = [['QUEDA', 'Queda'], ['ALTERACAO_CLINICA', 'Alteração clínica'], ['MEDICACAO', 'Medicação'], ['LESÃO', 'Lesão'], ['COMPORTAMENTO', 'Comportamento'], ['OUTRA', 'Outra']]
const severities = [['BAIXA', 'Baixa'], ['MODERADA', 'Moderada'], ['ALTA', 'Alta'], ['CRITICA', 'Crítica']]

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.mensagem || 'Não foi possível completar a solicitação.')
  return result
}

export default function IntercurrenceWorkspace({ patients, initialPatientId, visitId, isAdmin }: { patients: PatientOption[]; initialPatientId?: number | null; visitId?: number | null; isAdmin: boolean }) {
  const [items, setItems] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(Boolean(initialPatientId))
  const [patientId, setPatientId] = useState(initialPatientId ? String(initialPatientId) : '')
  const [patientQuery, setPatientQuery] = useState('')
  const [patientMatchesData, setPatientMatchesData] = useState<PatientOption[]>([])
  const [selectedPatientOption, setSelectedPatientOption] = useState<PatientOption | null>(null)
  const [patientSearchLoading, setPatientSearchLoading] = useState(false)
  const [patientPickerOpen, setPatientPickerOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('MODERADA')
  const [relato, setRelato] = useState('')
  const [conduta, setConduta] = useState('')
  const [encaminhamento, setEncaminhamento] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ABERTA')

  const selectedPatient = selectedPatientOption?.id.toString() === patientId ? selectedPatientOption : patients.find(patient => String(patient.id) === patientId) || patientMatchesData.find(patient => String(patient.id) === patientId)
  const patientMatches = patientMatchesData.slice(0, 7)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await api('/api/atendimento-clinico/intercorrencias?status=TODAS')
      setItems(result.intercorrencias || [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os registros.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!initialPatientId) return
    setPatientId(String(initialPatientId))
    setSelectedPatientOption(patients.find(patient => patient.id === initialPatientId) || null)
    setShowForm(true)
  }, [initialPatientId, patients])
  useEffect(() => {
    const query = patientQuery.trim()
    const acceptsQuery = query.length >= 2 || /^\d{1,10}$/.test(query.replace(/^#/, ''))
    let current = true
    if (!acceptsQuery) { setPatientMatchesData([]); setPatientSearchLoading(false); return }
    setPatientMatchesData([])
    setPatientSearchLoading(true)
    const timer = window.setTimeout(() => {
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      api(`/api/pacientes?data=${date}&limit=7&busca=${encodeURIComponent(query)}`)
        .then(result => { if (current) setPatientMatchesData(result.data || result.clientes || []) })
        .catch(() => { if (current) setPatientMatchesData([]) })
        .finally(() => { if (current) setPatientSearchLoading(false) })
    }, 250)
    return () => { current = false; window.clearTimeout(timer) }
  }, [patientQuery])

  const visible = useMemo(() => items.filter(item => {
    const statusOk = statusFilter === 'TODAS' || item.Status === statusFilter
    const q = query.trim().toLocaleLowerCase('pt-BR')
    const queryOk = !q || `${item.NomePaciente || ''} ${item.CodCli} ${item.Categoria} ${item.Gravidade} ${item.Relato}`.toLocaleLowerCase('pt-BR').includes(q)
    return statusOk && queryOk
  }), [items, query, statusFilter])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await api('/api/atendimento-clinico/intercorrencias', { method: 'POST', body: JSON.stringify({ codCli: Number(patientId), visitaId: visitId || null, categoria: category, gravidade: severity, relato, conduta, encaminhamento }) })
      setNotice('Intercorrência registrada e vinculada ao histórico clínico.')
      setShowForm(false); setCategory(''); setSeverity('MODERADA'); setRelato(''); setConduta(''); setEncaminhamento(''); setPatientId(''); setPatientQuery('')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a intercorrência.') }
    finally { setSaving(false) }
  }

  async function setStatus(item: Incident, status: string) {
    setError(''); setNotice('')
    try { await api(`/api/atendimento-clinico/intercorrencias/${item.IntercorrenciaId}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setNotice(status === 'RESOLVIDA' ? 'Intercorrência marcada como resolvida.' : 'Acompanhamento atualizado.'); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o acompanhamento.') }
  }

  return <section className="mx-auto w-full max-w-[1180px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[.16em] text-[var(--brand)]">SEGURANÇA DO CUIDADO</span><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">Intercorrências</h1><p className="mt-2 text-sm text-[var(--muted)]">Registre alterações relevantes, condutas e encaminhamentos junto ao histórico do idoso.</p></div><button type="button" onClick={() => setShowForm(value => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"><Plus size={17} />Nova intercorrência</button></header>
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}<button type="button" onClick={() => { setError(''); setNotice('') }} aria-label="Fechar mensagem"><X size={15} /></button></div>}
    {showForm && <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--white)] p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-[var(--ink)]">Registrar intercorrência</h2><p className="mt-1 text-sm text-[var(--muted)]">O registro ficará identificado com seu usuário e horário de inclusão.</p></div><button type="button" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--paper)]" onClick={() => setShowForm(false)} aria-label="Fechar formulário"><X size={17} /></button></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative md:col-span-2"><label htmlFor="incident-patient" className="mb-2 block text-sm font-semibold text-[var(--ink)]">Idoso <span className="text-rose-600">*</span></label><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" /><input id="incident-patient" value={selectedPatient ? `${selectedPatient.nome || selectedPatient.razao} · #${selectedPatient.id}` : patientQuery} onChange={event => { setPatientId(''); setSelectedPatientOption(null); setPatientQuery(event.target.value); setPatientPickerOpen(true) }} onFocus={() => setPatientPickerOpen(true)} placeholder="Pesquise por nome, código ou CPF" autoComplete="off" className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--white)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-pale)]" required={!patientId} /></div>
          {patientPickerOpen && patientQuery && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--line)] bg-[var(--white)] p-1 shadow-xl">{patientMatches.map(patient => <button key={patient.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setPatientId(String(patient.id)); setSelectedPatientOption(patient); setPatientQuery(''); setPatientPickerOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--paper)]"><span className="block text-sm font-semibold text-[var(--ink)]">{patient.nome || patient.razao} · #{patient.id}</span><span className="text-xs text-[var(--muted)]">{patient.bairro || 'Bairro não informado'}{patient.cpf_cnpj ? ` · ${patient.cpf_cnpj}` : ''}</span></button>)}{!patientMatches.length && <p className="px-3 py-3 text-sm text-[var(--muted)]">{patientSearchLoading ? 'Pesquisando idosos com escala ativa…' : 'Nenhum idoso com escala ativa encontrado.'}</p>}</div>}
        </div>
        <label className="text-sm font-semibold text-[var(--ink)]">Tipo <span className="text-rose-600">*</span><span className="relative mt-2 block"><select value={category} onChange={event => setCategory(event.target.value)} required className="min-h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--white)] px-3 pr-9 text-sm font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-pale)]"><option value="">Selecione o tipo</option>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" /></span></label>
        <label className="text-sm font-semibold text-[var(--ink)]">Gravidade <span className="text-rose-600">*</span><span className="relative mt-2 block"><select value={severity} onChange={event => setSeverity(event.target.value)} required className="min-h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--white)] px-3 pr-9 text-sm font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-pale)]">{severities.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" /></span></label>
        <label className="text-sm font-semibold text-[var(--ink)] md:col-span-2">Relato observado <span className="text-rose-600">*</span><textarea value={relato} onChange={event => setRelato(event.target.value)} minLength={5} maxLength={10000} rows={4} required placeholder="Descreva o que foi observado, incluindo horário aproximado e contexto relevante." className="mt-2 block w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--white)] p-3 text-sm font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-pale)]" /></label>
        <label className="text-sm font-semibold text-[var(--ink)]">Conduta adotada<textarea value={conduta} onChange={event => setConduta(event.target.value)} maxLength={10000} rows={3} placeholder="Ações realizadas e monitoramento recomendado." className="mt-2 block w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--white)] p-3 text-sm font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-pale)]" /></label>
        <label className="text-sm font-semibold text-[var(--ink)]">Encaminhamento<textarea value={encaminhamento} onChange={event => setEncaminhamento(event.target.value)} maxLength={300} rows={3} placeholder="Serviço, profissional ou familiar contatado." className="mt-2 block w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--white)] p-3 text-sm font-normal outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-pale)]" /></label>
      </div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] pt-4"><button type="button" onClick={() => setShowForm(false)} className="min-h-10 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink)]">Cancelar</button><button disabled={saving || !patientId} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Salvando…' : <><Check size={16} />Registrar intercorrência</>}</button></footer>
    </form>}
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--white)] shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4 md:p-5"><div><h2 className="font-semibold text-[var(--ink)]">Histórico de intercorrências</h2><p className="mt-1 text-sm text-[var(--muted)]">{visible.length} {visible.length === 1 ? 'registro' : 'registros'}</p></div><div className="flex flex-wrap gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Idoso ou tipo" className="min-h-10 w-52 rounded-xl border border-[var(--line)] bg-[var(--white)] pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--white)] px-3 text-sm"><option value="ABERTA">Abertas</option><option value="EM_ACOMPANHAMENTO">Em acompanhamento</option><option value="RESOLVIDA">Resolvidas</option><option value="TODAS">Todas</option></select></div></header>
      {loading ? <div className="p-8 text-center text-sm text-[var(--muted)]">Carregando histórico…</div> : !visible.length ? <div className="grid min-h-48 place-items-center p-8 text-center"><div><AlertTriangle className="mx-auto text-[var(--subtle)]" size={25} /><p className="mt-3 font-medium text-[var(--ink)]">Nenhuma intercorrência neste filtro</p><p className="mt-1 text-sm text-[var(--muted)]">Os registros em aberto aparecem aqui para acompanhamento.</p></div></div> : <div className="divide-y divide-[var(--line)]">{visible.map(item => <article key={item.IntercorrenciaId} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:p-5"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.Gravidade === 'CRITICA' || item.Gravidade === 'ALTA' ? 'bg-rose-100 text-rose-800' : item.Gravidade === 'MODERADA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{item.Gravidade}</span><span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">{item.Categoria.replaceAll('_', ' ')}</span><span className="text-xs text-[var(--subtle)]">{new Date(item.DataHora).toLocaleString('pt-BR')}</span></div><h3 className="mt-2 font-semibold text-[var(--ink)]">{item.NomePaciente || `Idoso #${item.CodCli}`} <span className="font-normal text-[var(--muted)]">· #{item.CodCli}</span></h3><p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink)]">{item.Relato}</p>{item.Conduta && <p className="mt-2 text-sm text-[var(--muted)]"><strong>Conduta:</strong> {item.Conduta}</p>}{item.Encaminhamento && <p className="mt-1 text-sm text-[var(--muted)]"><strong>Encaminhamento:</strong> {item.Encaminhamento}</p>}<p className="mt-2 text-xs text-[var(--subtle)]">Registrado por {item.Enfermeira || 'equipe clínica'}{item.Bairro ? ` · ${item.Bairro}` : ''}{isAdmin ? '' : ''}</p></div>
        {item.Status !== 'RESOLVIDA' && <div className="flex flex-wrap items-start gap-2 md:justify-end"><button type="button" onClick={() => setStatus(item, item.Status === 'ABERTA' ? 'EM_ACOMPANHAMENTO' : 'RESOLVIDA')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--ink)] hover:border-[var(--brand)]">{item.Status === 'ABERTA' ? 'Acompanhar' : 'Marcar resolvida'}</button>{item.Status === 'ABERTA' && <button type="button" onClick={() => setStatus(item, 'RESOLVIDA')} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"><Check size={14} />Resolver</button>}</div>}</article>)}</div>}
    </section>
  </section>
}
