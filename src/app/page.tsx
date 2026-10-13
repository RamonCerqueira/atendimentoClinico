'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, Bell, BellRing, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, HeartPulse, LogOut, MapPin, Moon, Pencil, Plus, Route, Search, ShieldAlert, ShieldCheck, Sun, UsersRound, WifiOff, X } from 'lucide-react'
import PatientWorkspace from './patient-workspace'
import ReportsWorkspace from './reports-workspace'
import VisitCalendar from './visit-calendar'
import PendingWorkspace, { type ClinicalNotification } from './pending-workspace'
import IntercurrenceWorkspace from './intercurrence-workspace'
import { type CarePlan, type CarePlanDraft } from './care-plan-workspace'

type Patient = { id: number; responsavel_id?: number; nome?: string; razao?: string; cpf_cnpj?: string | null; data_nascimento?: string; sexo?: string; telefone?: string; celular?: string; endereco?: string; bairro?: string; cidade?: string; segmento?: string; status?: string; responsavel_nome?: string; email?: string; patologias?: string; escala_id?: number | null; escala_inicio?: string | null; escala_fim?: string | null; escala_responsavel?: string | null; escala_contratante?: string | null; escala_cuidadores?: { id: number; nome: string }[] }
type Visit = { VisitaId: number; CodCli: number; NomePaciente?: string; Endereco?: string; Bairro?: string; Cidade?: string; DataHora: string; Status: string; Enfermeira?: string; EnfermeiraCodUsu?: number; IniciadoEm?: string | null; FinalizadoEm?: string | null }
type Nurse = { id: number; nome: string }
type ActiveScale = { id: number; codCli: number; idoso?: string; contratante?: string; status?: string; dataInicio?: string; dataFim?: string; responsavel?: string | null; cuidadores?: { id: number; nome: string }[] }
type Evolution = { EvolucaoId: number; CodCli: number; DataHora: string; Enfermeira?: string; PressaoArterial?: string; Spo2?: string; FrequenciaCardiaca?: string; Temperatura?: string; FrequenciaRespiratoria?: string; Hgt?: string; Consciencia?: string; CondicaoGeral?: string; Pele?: string; Observacoes?: string; PossuiLpp?: string; LocalizacaoLpp?: string; GrauLpp?: string; Curativos?: string; Lesoes?: string; Satisfacao?: string; SatisfacaoMonitoramentoSemana?: number | null; SatisfacaoMonitoramentoFimSemana?: number | null; SatisfacaoEquipeManha?: number | null; SatisfacaoEquipeTarde?: number | null; SatisfacaoMonitoramentoComunicacao?: number | null; SatisfacaoSuporteEnfermagem?: number | null; SatisfacaoCuidadoresDia?: number | null; SatisfacaoCuidadoresNoite?: number | null }
type MedicalProfile = { MotivoConsulta?: string; Patologias?: string; OutrosPatologias?: string; HistoricoFamiliar?: string; FichaAnamnese_Medicamento?: { MedicamentoId: number; Nome?: string; Dose?: string; Horarios?: string; Motivo?: string }[] }
type User = { id?: number; nome?: string; email?: string; perfil?: string; role?: string }
type Form = { pa: string; spo2: string; fc: string; temperatura: string; fr: string; hgt: string; consciencia: string; condicaoGeral: string; pele: string[]; observacoes: string; lpp: string; localizacaoLpp: string; grauLpp: string; curativos: string[]; lesoes: string; satisfacao: string; satisfacaoMonitoramentoComunicacao: number; satisfacaoSuporteEnfermagem: number; satisfacaoCuidadoresDia: number; satisfacaoCuidadoresNoite: number }

const blankForm: Form = { pa: '', spo2: '', fc: '', temperatura: '', fr: '', hgt: '', consciencia: '', condicaoGeral: '', pele: [], observacoes: '', lpp: '', localizacaoLpp: '', grauLpp: '', curativos: [], lesoes: '', satisfacao: '', satisfacaoMonitoramentoComunicacao: 0, satisfacaoSuporteEnfermagem: 0, satisfacaoCuidadoresDia: 0, satisfacaoCuidadoresNoite: 0 }
const blankCarePlan: CarePlanDraft = { Objetivos: '', Cuidados: '', Riscos: '', Contatos: '', RevisarEm: '' }
const menu = [{ key: 'agenda', label: 'Agenda', icon: CalendarDays }, { key: 'pacientes', label: 'Pacientes', icon: UsersRound }, { key: 'pendencias', label: 'Pendências', icon: BellRing }, { key: 'intercorrencias', label: 'Intercorrências', icon: ShieldAlert }]
const statusLabels: Record<string, string> = { PENDENTE: 'Aguardando confirmação', CONFIRMADA: 'Confirmada', EM_ATENDIMENTO: 'Em atendimento', CANCELADA: 'Cancelada', REALIZADA: 'Realizada' }

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.mensagem || result.message || 'Não foi possível completar a solicitação.')
  return result
}

function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function prettyDate(date: Date, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) { return new Intl.DateTimeFormat('pt-BR', options).format(date) }
function scaleDateLabel(value?: string | null) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() }
function years(date?: string) { if (!date) return null; const born = new Date(`${date.slice(0, 10)}T12:00:00`); if (Number.isNaN(+born)) return null; let age = new Date().getFullYear() - born.getFullYear(); if (new Date().getMonth() < born.getMonth() || (new Date().getMonth() === born.getMonth() && new Date().getDate() < born.getDate())) age--; return age }
function addressQuery(address?: string, neighborhood?: string, city?: string) { return [address, neighborhood, city].filter(Boolean).join(', ') }
function mapsUrl(address: string) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` }
function wazeUrl(address: string) { return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes` }
function dayRouteUrl(visits: Visit[]) {
  const destinations = visits.filter(visit => visit.Status !== 'CANCELADA').map(visit => addressQuery(visit.Endereco, visit.Bairro, visit.Cidade)).filter(Boolean)
  if (!destinations.length) return ''
  const params = new URLSearchParams({ api: '1', destination: destinations[destinations.length - 1]!, travelmode: 'driving' })
  if (destinations.length > 1) params.set('waypoints', destinations.slice(0, -1).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
function neighborhoodLabel(value?: string) { return value?.trim().replace(/\s+/g, ' ') || 'Bairro não informado' }
function neighborhoodKey(value?: string) { return neighborhoodLabel(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR') }
function bookingPatientLabel(patient: Patient) {
  const fullName = (patient.nome || patient.razao || `Idoso #${patient.id}`).trim()
  const patientFirstName = fullName.split(/\s+/)[0]?.toLocaleUpperCase('pt-BR') || 'SEM'
  const responsibleFirstName = patient.responsavel_nome?.trim().split(/\s+/)[0]?.toLocaleUpperCase('pt-BR')
  const responsibleLabel = responsibleFirstName && !['NÃO', 'NAO', 'SEM'].includes(responsibleFirstName) ? responsibleFirstName : patientFirstName
  return `${responsibleLabel} / ${patientFirstName} - ${fullName}`
}
function searchKey(value?: string) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim() }

export default function AtendimentoClinico() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [view, setView] = useState<'agenda' | 'pacientes' | 'pendencias' | 'intercorrencias' | 'relatorios'>('agenda')
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([])
  const [selectedPatientRecord, setSelectedPatientRecord] = useState<Patient | null>(null)
  const patientSearchRequestId = useRef(0)
  const [bookingCandidates, setBookingCandidates] = useState<Patient[]>([])
  const [bookingPatientRecords, setBookingPatientRecords] = useState<Record<string, Patient>>({})
  const [bookingCandidatesLoading, setBookingCandidatesLoading] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const [patientId, setPatientId] = useState<number | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(true)
  const [visitsError, setVisitsError] = useState('')
  const visitsRequestId = useRef(0)
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [notifications, setNotifications] = useState<ClinicalNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [evolutions, setEvolutions] = useState<Evolution[]>([])
  const [evolutionsPatientId, setEvolutionsPatientId] = useState<number | null>(null)
  const [medicalProfile, setMedicalProfile] = useState<MedicalProfile | null>(null)
  const [medicalProfilePatientId, setMedicalProfilePatientId] = useState<number | null>(null)
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null)
  const [carePlanPatientId, setCarePlanPatientId] = useState<number | null>(null)
  const [carePlanVersions, setCarePlanVersions] = useState<CarePlan[]>([])
  const [carePlanDraft, setCarePlanDraft] = useState(blankCarePlan)
  const [savingCarePlan, setSavingCarePlan] = useState(false)
  const carePlanRequestId = useRef(0)
  const evolutionsRequestId = useRef(0)
  const medicalProfileRequestId = useRef(0)
  const [activeVisitId, setActiveVisitId] = useState<number | null>(null)
  const currentPatientIdRef = useRef<number | null>(null)
  const [selectedDate, setSelectedDate] = useState(dayKey(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [bookingPatient, setBookingPatient] = useState('')
  const [bookingPatients, setBookingPatients] = useState<string[]>([])
  const [bookingNeighborhood, setBookingNeighborhood] = useState('')
  const [bookingNeighborhoodSearch, setBookingNeighborhoodSearch] = useState('')
  const [bookingNeighborhoodOpen, setBookingNeighborhoodOpen] = useState(false)
  const [activeBookingNeighborhoodSuggestion, setActiveBookingNeighborhoodSuggestion] = useState(0)
  const [bookingPatientSearch, setBookingPatientSearch] = useState('')
  const [bookingNurse, setBookingNurse] = useState('')
  const [bookingDate, setBookingDate] = useState(dayKey(new Date()))
  const [bookingTime, setBookingTime] = useState('09:00')
  const [bookingVisitId, setBookingVisitId] = useState<number | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('')
  const [clockNow, setClockNow] = useState(() => new Date())
  const [completedSummary, setCompletedSummary] = useState('')
  const [summaryCopied, setSummaryCopied] = useState(false)
  const [form, setForm] = useState<Form>(blankForm)
  const [formDrafts, setFormDrafts] = useState<Record<string, Form>>({})
  const [draftReadyKey, setDraftReadyKey] = useState('')
  const [draftState, setDraftState] = useState<'clean' | 'loading' | 'saving' | 'saved' | 'error'>('clean')
  const savedDraftKeys = useRef(new Set<string>())
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const isAdmin = user?.perfil === '3' || ['ADMIN', 'ADM'].includes(String(user?.role || '').toUpperCase())
  const navigation = isAdmin ? [...menu, { key: 'relatorios', label: 'Relatórios', icon: ClipboardList }] : menu

  const loadPatients = useCallback(async () => {
    const fromUrl = Number(new URLSearchParams(window.location.search).get('paciente'))
    if (!fromUrl) { setLoaded(true); return }
    try {
      const result = await api(`/api/pacientes?data=${dayKey(new Date())}&limit=8&busca=${fromUrl}`)
      const linkedPatient: Patient | undefined = (result.data || result.clientes || []).find((item: Patient) => item.id === fromUrl)
      if (linkedPatient) {
        setPatients(current => current.some(item => item.id === linkedPatient.id) ? current : [...current, linkedPatient])
        setPatientSearchResults([linkedPatient])
        setSelectedPatientRecord(linkedPatient)
        currentPatientIdRef.current = fromUrl
        setPatientId(fromUrl)
      }
    } finally { setLoaded(true) }
  }, [])

  useEffect(() => {
    if (!authenticated || !bookingOpen || bookingVisitId) return
    let current = true
    const neighborhood = bookingNeighborhood || bookingNeighborhoodSearch.trim()
    const query = bookingNeighborhood ? bookingPatientSearch.trim() : ''
    const hasSearch = Boolean(query || neighborhood)
    if (!hasSearch) { setBookingCandidates([]); setBookingCandidatesLoading(false); return }
    setBookingCandidatesLoading(true)
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ data: bookingDate, limit: '50', bairro: neighborhood })
      if (query) params.set('busca', query)
      if (bookingNeighborhood) params.set('bairroExato', '1')
      api(`/api/pacientes?${params.toString()}`)
        .then(result => {
          if (!current) return
          const found: Patient[] = result.data || result.clientes || []
          setBookingCandidates(found)
          setBookingPatientRecords(previous => ({ ...previous, ...Object.fromEntries(found.map(item => [String(item.id), item])) }))
        })
        .catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Não foi possível conferir as escalas desta data.') })
        .finally(() => { if (current) setBookingCandidatesLoading(false) })
    }, 250)
    return () => { current = false; window.clearTimeout(timer) }
  }, [authenticated, bookingDate, bookingNeighborhood, bookingNeighborhoodSearch, bookingOpen, bookingPatientSearch, bookingVisitId])

  const loadVisits = useCallback(async () => {
    const requestId = ++visitsRequestId.current
    const start = dayKey(calendarMonth)
    const end = dayKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0))
    setVisitsLoading(true)
    setVisitsError('')
    try {
      const result = await api(`/api/atendimento-clinico/visitas?inicio=${start}&fim=${end}`)
      if (requestId !== visitsRequestId.current) return
      setVisits(result.visitas || [])
      setNurses(result.enfermeiras || [])
    } catch (cause) {
      if (requestId !== visitsRequestId.current) return
      const message = cause instanceof Error ? cause.message : 'Não foi possível carregar as visitas.'
      setVisitsError(message)
      throw cause
    } finally {
      if (requestId === visitsRequestId.current) setVisitsLoading(false)
    }
  }, [calendarMonth])

  const loadNotifications = useCallback(async () => {
    const result = await api('/api/atendimento-clinico/notificacoes')
    setNotifications(result.notificacoes || [])
  }, [])

  const loadEvolutions = useCallback(async (id: number) => {
    const requestId = ++evolutionsRequestId.current
    setEvolutions([])
    setEvolutionsPatientId(null)
    try {
      const result = await api(`/api/atendimento-clinico/pacientes/${id}/evolucoes`)
      if (requestId !== evolutionsRequestId.current) return
      setEvolutions(result.evolucoes || [])
      setEvolutionsPatientId(id)
    } catch (cause) {
      if (requestId !== evolutionsRequestId.current) return
      throw cause
    }
  }, [])
  const loadMedicalProfile = useCallback(async (id: number) => {
    const requestId = ++medicalProfileRequestId.current
    setMedicalProfile(null)
    setMedicalProfilePatientId(null)
    try {
      const result = await api(`/api/clientes/${id}/anamnese`)
      if (requestId !== medicalProfileRequestId.current) return
      setMedicalProfile(result.anamnese || null)
      setMedicalProfilePatientId(id)
    } catch (cause) {
      if (requestId !== medicalProfileRequestId.current) return
      throw cause
    }
  }, [])
  const loadCarePlan = useCallback(async (id: number) => {
    const requestId = ++carePlanRequestId.current
    setCarePlan(null)
    setCarePlanPatientId(null)
    setCarePlanVersions([])
    setCarePlanDraft(blankCarePlan)
    const result = await api(`/api/atendimento-clinico/pacientes/${id}/plano`)
    if (requestId !== carePlanRequestId.current) return
    const plan: CarePlan | null = result.plano || null
    setCarePlan(plan)
    setCarePlanPatientId(id)
    setCarePlanVersions(result.versoes || (plan ? [plan] : []))
    if (plan) setCarePlanDraft({ Objetivos: plan.Objetivos || '', Cuidados: plan.Cuidados || '', Riscos: plan.Riscos || '', Contatos: plan.Contatos || '', RevisarEm: plan.RevisarEm ? String(plan.RevisarEm).slice(0, 10) : '' })
  }, [])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('cuidaamor-clinical-theme') || window.localStorage.getItem('softcare-clinical-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('cuidaamor-clinical-theme', theme)
  }, [theme])
  useEffect(() => {
    api('/api/auth/session').then(result => { setUser(result.user || null); setAuthenticated(true) }).catch(() => setAuthenticated(false))
  }, [])
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/service-worker.js').catch(() => undefined)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { if (authenticated) loadPatients().catch(e => setError(e.message)) }, [authenticated, loadPatients])
  useEffect(() => {
    if (!authenticated || view !== 'pacientes') return
    const query = patientSearch.trim()
    const acceptsQuery = query.length >= 2 || /^\d{1,10}$/.test(query.replace(/^#/, ''))
    const requestId = ++patientSearchRequestId.current
    if (!acceptsQuery) { setPatientSearchResults([]); setLoaded(true); return }
    let current = true
    setLoaded(false)
    setPatientSearchResults([])
    setError('')
    const timer = window.setTimeout(() => {
      api(`/api/pacientes?data=${dayKey(new Date())}&limit=8&busca=${encodeURIComponent(query)}`)
        .then(result => {
          if (!current || requestId !== patientSearchRequestId.current) return
          const found: Patient[] = result.data || result.clientes || []
          setPatientSearchResults(found)
          setPatients(previous => {
            const byId = new Map(previous.map(item => [item.id, item]))
            found.forEach(item => byId.set(item.id, item))
            return Array.from(byId.values())
          })
        })
        .catch(cause => { if (current && requestId === patientSearchRequestId.current) { setPatientSearchResults([]); setError(cause instanceof Error ? cause.message : 'Não foi possível pesquisar idosos.') } })
        .finally(() => { if (current && requestId === patientSearchRequestId.current) setLoaded(true) })
    }, 250)
    return () => { current = false; window.clearTimeout(timer) }
  }, [authenticated, patientSearch, view])
  useEffect(() => { if (authenticated && view === 'agenda') loadVisits().catch(e => setError(e.message)) }, [authenticated, view, loadVisits])
  useEffect(() => {
    if (!authenticated) return
    loadNotifications().catch(e => setError(e.message))
    const timer = window.setInterval(() => loadNotifications().catch(() => undefined), 60_000)
    return () => window.clearInterval(timer)
  }, [authenticated, loadNotifications])
  useEffect(() => { if (authenticated && patientId) { loadEvolutions(patientId).catch(e => setError(e.message)); loadMedicalProfile(patientId).catch(() => setMedicalProfile(null)); loadCarePlan(patientId).catch(e => setError(e.message)) } }, [authenticated, patientId, loadEvolutions, loadMedicalProfile, loadCarePlan])

  useEffect(() => {
    if (!authenticated || !patientId) return
    const key = `${patientId}:${activeVisitId || 'paciente'}`
    let current = true
    setDraftReadyKey('')
    setDraftState('loading')
    const suffix = activeVisitId ? `?visitaId=${activeVisitId}` : ''
    api(`/api/atendimento-clinico/pacientes/${patientId}/evolucoes/rascunho${suffix}`)
      .then(result => {
        if (!current) return
        if (result.dados && typeof result.dados === 'object') {
          setForm(result.dados as Form)
          setFormDrafts(existing => ({ ...existing, [`${patientId}:${activeVisitId || 'paciente'}`]: result.dados as Form }))
          savedDraftKeys.current.add(key)
          setDraftState('saved')
        } else setDraftState('clean')
      })
      .catch(() => { if (current) setDraftState('error') })
      .finally(() => { if (current) setDraftReadyKey(key) })
    return () => { current = false }
  }, [authenticated, patientId, activeVisitId])

  useEffect(() => {
    if (!authenticated || !patientId) return
    const key = `${patientId}:${activeVisitId || 'paciente'}`
    if (draftReadyKey !== key || saving) return
    const hasContent = Object.values(form).some(value => Array.isArray(value) ? value.length > 0 : value !== '' && value !== 0)
    const suffix = activeVisitId ? `?visitaId=${activeVisitId}` : ''
    if (!hasContent) {
      setDraftState('clean')
      if (savedDraftKeys.current.has(key)) {
        savedDraftKeys.current.delete(key)
        void fetch(`/api/atendimento-clinico/pacientes/${patientId}/evolucoes/rascunho${suffix}`, { method: 'DELETE' }).catch(() => undefined)
      }
      return
    }
    setDraftState('saving')
    const timer = window.setTimeout(() => {
      api(`/api/atendimento-clinico/pacientes/${patientId}/evolucoes/rascunho`, { method: 'PUT', body: JSON.stringify({ visitaId: activeVisitId, dados: form }) })
        .then(() => { savedDraftKeys.current.add(key); setDraftState('saved') })
        .catch(() => setDraftState('error'))
    }, 900)
    return () => window.clearTimeout(timer)
  }, [authenticated, patientId, activeVisitId, form, draftReadyKey, saving])

  const patient = selectedPatientRecord?.id === patientId ? selectedPatientRecord : patients.find(item => item.id === patientId) || null
  const patientScale: ActiveScale | undefined = patient?.escala_id ? {
    id: Number(patient.escala_id), codCli: patient.id, idoso: patient.nome || patient.razao,
    contratante: patient.escala_contratante || undefined, status: 'ATIVO',
    dataInicio: scaleDateLabel(patient.escala_inicio), dataFim: scaleDateLabel(patient.escala_fim),
    responsavel: patient.escala_responsavel, cuidadores: patient.escala_cuidadores || [],
  } : undefined
  const filteredPatients = useMemo(() => {
    return patientSearch.trim() ? patientSearchResults.slice(0, 8) : []
  }, [patientSearchResults, patientSearch])
  const regionOptions = useMemo(() => {
    const unique = new Map<string, string>()
    visits.forEach(visit => { if (visit.Bairro?.trim()) unique.set(neighborhoodKey(visit.Bairro), neighborhoodLabel(visit.Bairro)) })
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [visits])
  useEffect(() => {
    if (!visitsLoading && !visitsError && neighborhoodFilter && !regionOptions.some(name => neighborhoodKey(name) === neighborhoodKey(neighborhoodFilter))) {
      setNeighborhoodFilter('')
    }
  }, [neighborhoodFilter, regionOptions, visitsError, visitsLoading])
  const visibleVisits = useMemo(() => neighborhoodFilter ? visits.filter(visit => neighborhoodKey(visit.Bairro) === neighborhoodKey(neighborhoodFilter)) : visits, [visits, neighborhoodFilter])
  const dayVisits = useMemo(() => visitsLoading || visitsError ? [] : visibleVisits.filter(visit => dayKey(new Date(visit.DataHora)) === selectedDate), [visibleVisits, selectedDate, visitsError, visitsLoading])
  const nextVisit = useMemo(() => visitsLoading || visitsError ? null : visits.filter(visit => dayKey(new Date(visit.DataHora)) === dayKey(clockNow) && ['CONFIRMADA', 'PENDENTE', 'EM_ATENDIMENTO'].includes(visit.Status) && (visit.Status === 'EM_ATENDIMENTO' || new Date(visit.DataHora).getTime() >= clockNow.getTime())).sort((a, b) => +new Date(a.DataHora) - +new Date(b.DataHora))[0] || null, [visits, clockNow, visitsError, visitsLoading])
  const bookingGroups = useMemo(() => {
    const groups = new Map<string, { neighborhood: string; patients: Patient[] }>()
    bookingCandidates.forEach(item => {
      const neighborhood = neighborhoodLabel(item.bairro)
      const key = neighborhoodKey(neighborhood)
      const group = groups.get(key) || { neighborhood, patients: [] }
      group.patients.push(item)
      groups.set(key, group)
    })
    return Array.from(groups.values()).sort((a, b) => a.neighborhood.localeCompare(b.neighborhood, 'pt-BR'))
  }, [bookingCandidates])
  const bookingNeighborhoodSuggestions = useMemo(() => {
    const query = searchKey(bookingNeighborhoodSearch)
    if (!query || bookingNeighborhood) return []
    return bookingGroups.filter(group => searchKey(group.neighborhood).includes(query)).slice(0, 8)
  }, [bookingGroups, bookingNeighborhood, bookingNeighborhoodSearch])
  const selectedBookingGroup = useMemo(() => bookingNeighborhood ? {
    neighborhood: bookingNeighborhood,
    patients: bookingCandidates.filter(item => neighborhoodKey(item.bairro) === neighborhoodKey(bookingNeighborhood)),
  } : undefined, [bookingCandidates, bookingNeighborhood])
  function getBookingPatient(id: number | string) {
    return bookingPatientRecords[String(id)] || bookingCandidates.find(item => String(item.id) === String(id)) || patients.find(item => String(item.id) === String(id))
  }
  const bookingGroupPatients = useMemo(() => {
    if (!selectedBookingGroup) return []
    const query = searchKey(bookingPatientSearch)
    if (!query) return []
    const digits = bookingPatientSearch.replace(/\D/g, '')
    const codeQuery = bookingPatientSearch.trim().replace(/^#/, '')
    return selectedBookingGroup.patients.filter(item => {
      const nameMatches = searchKey(`${bookingPatientLabel(item)} ${item.nome || ''} ${item.razao || ''} ${item.responsavel_nome || ''}`).includes(query)
      const codeMatches = /^\d+$/.test(codeQuery) && String(item.id).includes(codeQuery)
      const cpfDigits = String(item.cpf_cnpj || '').replace(/\D/g, '')
      const cpfMatches = digits.length >= 3 && cpfDigits.includes(digits)
      return nameMatches || codeMatches || cpfMatches
    }).slice(0, 8)
  }, [bookingPatientSearch, selectedBookingGroup])
  const bookingSelection = bookingPatients.length ? bookingPatients : bookingPatient ? [bookingPatient] : []
  const batchTimeSlots = useMemo(() => bookingSelection.map((_, index) => {
    const start = new Date(`${bookingDate}T${bookingTime}:00`)
    start.setMinutes(start.getMinutes() + index * 90)
    return { date: dayKey(start), time: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }) }
  }), [bookingSelection, bookingDate, bookingTime])

  function selectCalendarDate(value: string) {
    setSelectedDate(value)
    const date = new Date(`${value}T12:00:00`)
    if (!Number.isNaN(date.getTime())) setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  function changeCalendarMonth(delta: number) {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1)
    setCalendarMonth(nextMonth)
    const nextDate = dayKey(nextMonth)
    setSelectedDate(nextDate)
    setBookingDate(nextDate)
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setLoginError(''); setLoginBusy(true)
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setUser(result.user); setAuthenticated(true)
    } catch (e) { setLoginError(e instanceof Error ? e.message : 'Não foi possível entrar.') } finally { setLoginBusy(false) }
  }

  async function signOut() {
    try { await fetch('/api/auth/session', { method: 'DELETE' }) } catch { /* Continue cleaning the in-memory clinical context even if the session endpoint is unavailable. */ }
    finally {
      ++visitsRequestId.current; ++evolutionsRequestId.current; ++medicalProfileRequestId.current; ++carePlanRequestId.current
      currentPatientIdRef.current = null
      setAuthenticated(false); setPatientId(null); setSelectedPatientRecord(null); setPatientSearch(''); setPatientSearchResults([]); setPatients([])
      setBookingCandidates([]); setBookingPatientRecords({}); setVisits([]); setNotifications([]); setUser(null); setForm(blankForm); setFormDrafts({}); setEvolutions([]); setEvolutionsPatientId(null); setMedicalProfile(null); setMedicalProfilePatientId(null); setCarePlan(null); setCarePlanPatientId(null); setCarePlanVersions([]); setCarePlanDraft(blankCarePlan)
    }
  }

  function updatePatientForm(next: Form | ((current: Form) => Form)) {
    if (saving) return
    const updated = typeof next === 'function' ? next(form) : next
    setForm(updated)
    if (patientId !== null) setFormDrafts(current => ({ ...current, [`${patientId}:${activeVisitId || 'paciente'}`]: updated }))
  }

  function selectPatient(id: number, visitId?: number) {
    const cached = patientSearchResults.find(item => item.id === id) || patients.find(item => item.id === id)
    setSelectedPatientRecord(cached || null)
    currentPatientIdRef.current = id
    if (patientId !== id || activeVisitId !== (visitId ?? null)) {
      ++evolutionsRequestId.current; ++medicalProfileRequestId.current; ++carePlanRequestId.current
      setForm(formDrafts[`${id}:${visitId || 'paciente'}`] || blankForm); setEvolutions([]); setEvolutionsPatientId(null); setMedicalProfile(null); setMedicalProfilePatientId(null); setCarePlan(null); setCarePlanPatientId(null); setCarePlanVersions([]); setCarePlanDraft(blankCarePlan)
    }
    setPatientId(id); setActiveVisitId(visitId ?? null); setPatientSearch(''); setActiveSuggestion(0); setView('pacientes'); setNotice(''); setError(''); window.history.replaceState(null, '', `?paciente=${id}`)
    if (!cached) {
      api(`/api/pacientes?data=${dayKey(new Date())}&limit=1&busca=${id}`)
        .then(result => {
          const found: Patient | undefined = (result.data || result.clientes || []).find((item: Patient) => item.id === id)
          if (!found || currentPatientIdRef.current !== id) return
          setSelectedPatientRecord(found)
          setPatients(previous => previous.some(item => item.id === id) ? previous : [...previous, found])
        })
        .catch(() => undefined)
    }
  }

  async function createVisit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('')
    if (bookingDate < dayKey(new Date())) { setError('Não é possível agendar visitas em dias anteriores a hoje.'); return }
    const localDate = new Date(`${bookingDate}T${bookingTime}:00`)
    if (localDate.getTime() <= Date.now()) { setError('Escolha um horário futuro para a visita.'); return }
    try {
      if (bookingVisitId) {
        await api(`/api/atendimento-clinico/visitas/${bookingVisitId}`, { method: 'PATCH', body: JSON.stringify({ dataHora: localDate.toISOString() }) })
        const nextMonth = new Date(localDate.getFullYear(), localDate.getMonth(), 1)
        setCalendarMonth(nextMonth)
        setSelectedDate(dayKey(localDate))
        setNotice('Visita remarcada na agenda.')
      } else {
        const selectedPatients = bookingSelection
        if (!selectedPatients.length) { setError('Selecione ao menos um idoso para agendar.'); return }
        const selectedRegions = new Set(selectedPatients.map(id => neighborhoodKey(getBookingPatient(id)?.bairro)))
        if (selectedPatients.length > 1 && selectedRegions.size !== 1) { setError('Agende em lote os idosos de um mesmo bairro.'); return }
        const batch = selectedPatients.map((id, index) => {
          const slot = batchTimeSlots[index]
          if (!slot) throw new Error('Não foi possível sugerir um horário para uma das visitas selecionadas.')
          const visitDate = new Date(`${slot.date}T${slot.time}:00`)
          if (slot.date !== bookingDate || visitDate.getTime() <= Date.now()) throw new Error('Os horários sugeridos precisam permanecer no dia escolhido e no futuro. Ajuste o horário inicial ou reduza a seleção.')
          return { codCli: Number(id), dataHora: visitDate.toISOString() }
        })
        if (batch.length > 1) await api('/api/atendimento-clinico/visitas/lote', { method: 'POST', body: JSON.stringify({ visitas: batch, enfermeiraCodUsu: isAdmin ? Number(bookingNurse) : undefined }) })
        else await api('/api/atendimento-clinico/visitas', { method: 'POST', body: JSON.stringify({ ...batch[0], enfermeiraCodUsu: isAdmin ? Number(bookingNurse) : undefined }) })
        const nextMonth = new Date(localDate.getFullYear(), localDate.getMonth(), 1)
        setCalendarMonth(nextMonth)
        setSelectedDate(dayKey(localDate))
        setNotice(batch.length > 1 ? `${batch.length} visitas incluídas na agenda com intervalos de 90 minutos.` : 'Visita incluída na agenda.')
      }
      setBookingOpen(false); setBookingPatient(''); setBookingPatients([]); clearBookingNeighborhood(); setBookingPatientSearch(''); setBookingNurse(''); setBookingVisitId(null)
      await loadVisits().catch(() => undefined)
      await loadNotifications().catch(() => undefined)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível agendar a visita.') }
  }

  function openReschedule(visit: Visit) {
    const date = new Date(visit.DataHora)
    const initialDate = date.getTime() <= Date.now() ? dayKey(new Date()) : dayKey(date)
    const defaultSlot = defaultBookingSlot(initialDate)
    clearBookingNeighborhood()
    setBookingVisitId(visit.VisitaId)
    setBookingPatient(String(visit.CodCli))
    setBookingPatientRecords(previous => ({ ...previous, [String(visit.CodCli)]: { id: visit.CodCli, nome: visit.NomePaciente, bairro: visit.Bairro } }))
    setBookingPatients([])
    setBookingPatientSearch('')
    setBookingNurse(String(visit.EnfermeiraCodUsu || ''))
    setBookingDate(initialDate)
    setBookingTime(date.getTime() <= Date.now() ? defaultSlot.time : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }))
    setBookingOpen(true)
  }

  function toggleBookingPatient(id: string, neighborhood: string) {
    if (bookingNeighborhood && neighborhoodKey(bookingNeighborhood) !== neighborhoodKey(neighborhood)) return
    const selected = bookingPatients.includes(id)
    const next = selected ? bookingPatients.filter(value => value !== id) : [...bookingPatients, id]
    setBookingPatients(next)
    const selectedRecord = bookingCandidates.find(item => String(item.id) === id)
    if (selectedRecord) setBookingPatientRecords(previous => ({ ...previous, [id]: selectedRecord }))
    setBookingPatient('')
    setBookingNeighborhood(neighborhood)
    setBookingNeighborhoodSearch(neighborhood)
  }

  function chooseBookingNeighborhood(neighborhood: string) {
    setBookingNeighborhood(neighborhood)
    setBookingNeighborhoodSearch(neighborhood)
    setBookingNeighborhoodOpen(false)
    setActiveBookingNeighborhoodSuggestion(0)
    setBookingPatientSearch('')
    setBookingPatients([])
    setBookingCandidates([])
    setBookingPatient('')
  }

  function clearBookingNeighborhood() {
    setBookingNeighborhood('')
    setBookingNeighborhoodSearch('')
    setBookingNeighborhoodOpen(false)
    setActiveBookingNeighborhoodSuggestion(0)
    setBookingPatientSearch('')
    setBookingPatients([])
    setBookingCandidates([])
    setBookingPatient('')
  }

  function handleBookingNeighborhoodKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setBookingNeighborhoodOpen(false); return }
    if (!bookingNeighborhoodSuggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveBookingNeighborhoodSuggestion(current => Math.min(current + 1, bookingNeighborhoodSuggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveBookingNeighborhoodSuggestion(current => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = bookingNeighborhoodSuggestions[activeBookingNeighborhoodSuggestion]
      if (option) chooseBookingNeighborhood(option.neighborhood)
    }
  }

  async function moveVisit(visitId: number, targetDate: string) {
    const visit = visits.find(item => item.VisitaId === visitId)
    if (!visit || !['PENDENTE', 'CONFIRMADA'].includes(visit.Status)) return
    const original = new Date(visit.DataHora)
    const time = original.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    const destination = new Date(`${targetDate}T${time}:00`)
    if (destination.getTime() <= Date.now()) { setError('Esse horário já passou. Escolha outro dia ou use “Remarcar” para alterar também o horário.'); return }
    try {
      await api(`/api/atendimento-clinico/visitas/${visitId}`, { method: 'PATCH', body: JSON.stringify({ dataHora: destination.toISOString() }) })
      const nextMonth = new Date(destination.getFullYear(), destination.getMonth(), 1)
      const monthChanged = nextMonth.getMonth() !== calendarMonth.getMonth() || nextMonth.getFullYear() !== calendarMonth.getFullYear()
      setCalendarMonth(nextMonth); setSelectedDate(targetDate); setError(''); setNotice(`Visita de ${visit.NomePaciente || `idoso #${visit.CodCli}`} remarcada para ${destination.toLocaleDateString('pt-BR')} às ${time}.`)
      if (!monthChanged) await loadVisits()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível remarcar a visita.') }
  }

  function openNewBooking(date = selectedDate) {
    setBookingVisitId(null)
    setBookingPatient('')
    setBookingPatients([])
    setBookingCandidates([])
    setBookingPatientRecords({})
    clearBookingNeighborhood()
    setBookingPatientSearch('')
    setBookingNurse('')
    const requestedDate = date < dayKey(new Date()) ? dayKey(new Date()) : date
    const slot = defaultBookingSlot(requestedDate)
    const nextMonth = new Date(`${slot.date}T12:00:00`)
    setCalendarMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1))
    setSelectedDate(slot.date)
    setBookingDate(slot.date)
    setBookingTime(slot.time)
    setBookingOpen(true)
  }

  function currentLocalTime() {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  }

  function defaultBookingSlot(date: string) {
    if (date !== dayKey(new Date())) return { date, time: '09:00' }
    const timeParts = currentLocalTime().split(':')
    const hours = Number(timeParts[0] || 0)
    const minutes = Number(timeParts[1] || 0)
    const next = new Date()
    next.setHours(hours, minutes + 15, 0, 0)
    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15)
    if (dayKey(next) !== date) { next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0); return { date: dayKey(next), time: '09:00' } }
    return { date, time: `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}` }
  }

  function changeBookingDate(date: string) {
    if (!date) return
    const today = dayKey(new Date())
    if (date < today) {
      setError('Não é possível agendar visitas em dias anteriores a hoje.')
      const slot = defaultBookingSlot(today)
      setBookingDate(slot.date)
      setBookingTime(slot.time)
      return
    }
    const chosenDate = date === dayKey(new Date()) && bookingTime < currentLocalTime() ? defaultBookingSlot(date) : { date, time: bookingTime }
    if (chosenDate.date !== bookingDate) {
      setBookingPatients([])
      setBookingPatient('')
      clearBookingNeighborhood()
    }
    setBookingDate(chosenDate.date)
    setBookingTime(chosenDate.time)
  }

  function openNotification(item: ClinicalNotification) {
    setNotificationsOpen(false)
    if (item.type === 'incident') {
      setView('intercorrencias')
      return
    }
    if (['evolution', 'careplan', 'draft', 'scale'].includes(item.type)) {
      selectPatient(item.patientId, item.visitId)
      return
    }
    const date = new Date(`${item.date}T12:00:00`)
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setSelectedDate(item.date)
    setView('agenda')
  }

  async function updateVisit(id: number, status: string) {
    try { await api(`/api/atendimento-clinico/visitas/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadVisits(); await loadNotifications(); setNotice(`Visita ${statusLabels[status]?.toLocaleLowerCase('pt-BR') || 'atualizada'}.`) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a visita.') }
  }

  async function startVisit(id: number) {
    try {
      const visit = visits.find(item => item.VisitaId === id)
      await api(`/api/atendimento-clinico/visitas/${id}`, { method: 'PATCH', body: JSON.stringify({ acao: 'iniciar' }) })
      if (visit) {
        selectPatient(visit.CodCli, visit.VisitaId)
        setNotice('Atendimento iniciado. Registre a evolução do paciente.')
      } else setNotice('Atendimento iniciado.')
      void loadVisits().catch(e => setError(e instanceof Error ? e.message : 'Não foi possível atualizar a agenda.'))
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar o atendimento.') }
  }

  async function saveEvolution(event: React.FormEvent, visitId?: number) {
    event.preventDefault(); if (!patient) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api(`/api/atendimento-clinico/pacientes/${patient.id}/evolucoes`, { method: 'POST', body: JSON.stringify({ ...form, visitaId: visitId ?? null }) })
      if (visitId) {
        const details = [
          form.pa && `PA ${form.pa} mmHg`, form.spo2 && `SpO₂ ${form.spo2}%`, form.fc && `FC ${form.fc} bpm`,
          form.temperatura && `Temperatura ${form.temperatura} °C`, form.fr && `FR ${form.fr} irpm`, form.hgt && `HGT ${form.hgt}`,
        ].filter(Boolean)
        const assessment = [form.consciencia, form.condicaoGeral && `Condição geral: ${form.condicaoGeral}`, form.observacoes].filter(Boolean)
        const care = [form.lpp === 'Sim' && `LPP registrada${form.localizacaoLpp ? ` em ${form.localizacaoLpp}` : ''}${form.grauLpp ? ` (${form.grauLpp})` : ''}`, ...form.curativos, form.lesoes].filter(Boolean)
        const greeting = patientScale?.contratante || patient.responsavel_nome
        const summary = [
          greeting ? `Olá, ${greeting}!` : 'Olá!',
          `A enfermeira ${user?.nome || 'da equipe Cuida Amor'} concluiu a visita de hoje de ${patient.nome || patient.razao || `idoso #${patient.id}`}.`,
          details.length ? `🩺 Sinais registrados: ${details.join('; ')}.` : '',
          assessment.length ? `📋 Avaliação registrada: ${assessment.join('; ')}.` : '',
          care.length ? `🩹 Cuidados registrados: ${care.join('; ')}.` : '',
          'Atenciosamente, Equipe Cuida Amor',
        ].filter(Boolean).join('\n\n')
        setCompletedSummary(summary)
        setSummaryCopied(false)
      }
      const savedKey = `${patient.id}:${visitId || 'paciente'}`
      savedDraftKeys.current.delete(savedKey)
      setFormDrafts(current => { const next = { ...current }; delete next[savedKey]; return next })
      if (currentPatientIdRef.current === patient.id) { setForm(blankForm); setActiveVisitId(null) }
      await loadEvolutions(patient.id); await loadVisits(); await loadNotifications().catch(() => undefined); setNotice('Evolução salva no prontuário.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a evolução.') } finally { setSaving(false) }
  }

  async function saveCarePlan(event: React.FormEvent) {
    event.preventDefault(); if (!patient) return
    setSavingCarePlan(true); setError(''); setNotice('')
    try {
      const result = await api(`/api/atendimento-clinico/pacientes/${patient.id}/plano`, { method: 'POST', body: JSON.stringify({ objetivos: carePlanDraft.Objetivos, cuidados: carePlanDraft.Cuidados, riscos: carePlanDraft.Riscos, contatos: carePlanDraft.Contatos, revisarEm: carePlanDraft.RevisarEm || null }) })
      setCarePlan(result.plano || null)
      setCarePlanPatientId(patient.id)
      setCarePlanVersions(current => [result.plano, ...current].filter(Boolean).slice(0, 10))
      setNotice('Nova versão do plano de cuidado salva.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o plano de cuidado.') } finally { setSavingCarePlan(false) }
  }

  function toggleList(field: 'pele' | 'curativos', value: string) {
    updatePatientForm(prev => ({ ...prev, [field]: prev[field].includes(value) ? prev[field].filter(item => item !== value) : [...prev[field], value] }))
  }

  function handlePatientSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && filteredPatients.length) {
      event.preventDefault()
      setActiveSuggestion(index => Math.min(index + 1, filteredPatients.length - 1))
    } else if (event.key === 'ArrowUp' && filteredPatients.length) {
      event.preventDefault()
      setActiveSuggestion(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && patientSearch.trim() && filteredPatients.length) {
      event.preventDefault()
      selectPatient(filteredPatients[activeSuggestion]?.id ?? filteredPatients[0]!.id)
    } else if (event.key === 'Escape') {
      setPatientSearch('')
      setActiveSuggestion(0)
    }
  }

  async function copyCompletedSummary() {
    try {
      await navigator.clipboard.writeText(completedSummary)
      setSummaryCopied(true)
    } catch {
      setError('Não foi possível copiar o resumo. Selecione o texto e copie manualmente.')
    }
  }

  if (authenticated === null) return <main className="loading"><span className="spinner" />Conectando ao Cuida Amor…</main>
  if (!authenticated) return <main className="login-shell"><section className="login-art"><div className="brand-lockup login-art-brand"><div className="login-art-logo-card"><img src="/logo01.svg" alt="Cuida Amor" className="login-art-logo-img" /></div><div><strong>Cuida Amor</strong><span>cuidado que conecta</span></div></div><div className="art-copy"><span className="eyebrow light">ATENDIMENTO CLÍNICO</span><h1>Um cuidado melhor começa com uma boa informação.</h1><p>Agenda, contexto do paciente e evolução clínica em um só lugar.</p></div><div className="art-foot">Cuidado com presença. Informação com propósito.</div><div className="art-orb orb-one" /><div className="art-orb orb-two" /></section><section className="login-panel"><form onSubmit={signIn} className="login-card"><div className="login-card-logo-wrap"><img src="/logo01.svg" alt="Cuida Amor" className="login-card-logo-img" /></div><span className="eyebrow">ÁREA DA ENFERMAGEM</span><h2>Bem-vinda de volta</h2><p className="muted">Entre com seu acesso do sistema Cuida Amor.</p>{loginError && <div className="alert error">{loginError}</div>}<label className="field-label" htmlFor="email">E-mail ou usuário</label><input id="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.usuario@cuidaamor.com.br" required /><label className="field-label" htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Digite sua senha" required /><button className="primary wide" disabled={loginBusy}>{loginBusy ? 'Entrando…' : 'Entrar no atendimento'}<ChevronRight size={18} /></button><div className="secure-note"><ShieldCheck size={15} /> Acesso seguro vinculado ao seu usuário Cuida Amor</div></form><div className="login-help">Precisa de ajuda? Fale com a administração.</div></section></main>

  return <main className="app-shell">
    <aside className="sidebar"><a className="brand-lockup sidebar-brand" href="#agenda"><div className="sidebar-logo-badge"><img src="/logo01.svg" alt="Cuida Amor" className="sidebar-logo-img" /></div><div><strong>Cuida Amor</strong><span>ATENDIMENTO CLÍNICO</span></div></a><div className="side-section-label">ESPAÇO DE TRABALHO</div><nav className="main-nav">{navigation.map(item => { const count = item.key === 'agenda' ? dayVisits.filter(v => v.Status !== 'CANCELADA').length : item.key === 'pendencias' ? notifications.length : 0; return <button key={item.key} className={`nav-item ${view === item.key ? 'active' : ''}`} onClick={() => { setView(item.key as 'agenda' | 'pacientes' | 'pendencias' | 'intercorrencias' | 'relatorios'); setNotice(''); setError('') }} title={item.label}><span className="nav-icon-box"><item.icon size={19} strokeWidth={1.9} />{count > 0 && <span className="nav-badge-mobile">{count > 99 ? '99+' : count}</span>}</span><span className="nav-label">{item.label}</span>{count > 0 && <span className="nav-count nav-count-desktop">{count}</span>}</button> })}</nav><div className="sidebar-note"><div className="note-icon"><Activity size={17} /></div><div><strong>Registre cada cuidado</strong><span>O histórico do paciente fica reunido em sua ficha.</span></div></div><div className="side-user"><div className="avatar user-avatar">{initials(user?.nome || 'EN')}</div><div className="side-user-copy"><strong>{user?.nome || 'Equipe clínica'}</strong><span>{isAdmin ? 'Acesso administrativo' : 'Equipe de enfermagem'}</span></div><button className="icon-button signout" title="Sair" onClick={signOut}><LogOut size={17} /></button></div></aside>
    <section className="workspace"><header className="topbar flex min-w-0"><div className="breadcrumbs min-w-0 flex-1 overflow-hidden"><img src="/logo01.svg" alt="Cuida Amor" className="topbar-logo-img hidden sm:inline-block" /><span className="hidden sm:inline">Cuida Amor</span><ChevronRight className="hidden sm:block" size={14} /><strong className="truncate">{view === 'agenda' ? 'Agenda clínica' : view === 'relatorios' ? 'Relatórios clínicos' : view === 'pendencias' ? 'Pendências' : view === 'intercorrencias' ? 'Intercorrências' : 'Pacientes'}</strong>{patient && view === 'pacientes' && <><ChevronRight className="hidden sm:block" size={14} /><strong className="breadcrumb-patient hidden truncate sm:block">{patient.nome || patient.razao}</strong></>}</div><div className="top-actions shrink-0"><div className="today-chip"><span className="online-dot" /> Ambiente clínico</div><button className="icon-button theme-toggle" type="button" aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><div className="notification-anchor"><button className={`notification-trigger ${notificationsOpen ? 'active' : ''}`} aria-label={`${notifications.length} notificações`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} />{notifications.length > 0 && <span className="notification-count">{notifications.length > 9 ? '9+' : notifications.length}</span>}</button>{notificationsOpen && <section className="notification-popover"><div className="notification-heading"><div><strong>Notificações</strong><span>{notifications.length ? `${notifications.length} pendência${notifications.length === 1 ? '' : 's'} para acompanhar` : 'Tudo em dia'}</span></div><button className="icon-button" onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações"><X size={16} /></button></div>{notifications.length ? <div className="notification-list">{notifications.map(item => <button className={`notification-item ${item.type}`} key={item.id} onClick={() => openNotification(item)}><span className="notification-mark">{item.type === 'evolution' || item.type === 'draft' ? <Activity size={16} /> : item.type === 'careplan' ? <ClipboardList size={16} /> : item.type === 'incident' ? <ShieldAlert size={16} /> : item.type === 'scale' ? <AlertTriangle size={16} /> : item.type === 'confirmation' ? <Clock3 size={16} /> : <CalendarDays size={16} />}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.patientName}{isAdmin ? ` · ${item.nurseName}` : ''}</span><small>{item.detail}</small><small>{new Date(item.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><ChevronRight size={16} /></button>)}</div> : <div className="notification-empty"><Check size={17} />Nenhuma pendência por enquanto.</div>}</section>}</div><div className="avatar top-avatar max-[480px]:hidden">{initials(user?.nome || 'EN')}</div></div></header>
      <div className="content-area">
        {!isOnline && <div className="connection-banner" role="status"><WifiOff size={18} /><div><strong>Sem conexão com a internet</strong><span>Agenda e registros clínicos precisam de conexão. O formulário não será salvo offline.</span></div></div>}
        {(notice || error) && <div className={`toast ${error ? 'toast-error' : ''}`} role="status">{error ? <X size={16} /> : <Check size={16} />}{error || notice}<button onClick={() => { setNotice(''); setError('') }} aria-label="Fechar"><X size={15} /></button></div>}
        {view === 'agenda' && <>
          <div className="page-heading"><div><span className="eyebrow">ROTINA DE CUIDADO</span><h1>Agenda clínica</h1><p>Acompanhe as visitas e organize os próximos atendimentos.</p></div><div className="flex flex-wrap gap-2">{dayRouteUrl(dayVisits) ? <a className="secondary" href={dayRouteUrl(dayVisits)} target="_blank" rel="noreferrer"><Route size={17} />Traçar rota do dia</a> : <button className="secondary route-disabled" type="button" disabled title="Adicione endereços às visitas para montar uma rota"><Route size={17} />Traçar rota do dia</button>}<button className="primary" onClick={() => openNewBooking()}><Plus size={18} />Agendar visita</button></div></div>
          <section className="welcome-strip"><div className="welcome-icon"><CalendarDays size={22} /></div><div><span className="welcome-kicker">SEU DIA DE CUIDADO</span><strong>{prettyDate(new Date(`${selectedDate}T12:00:00`))}</strong><span>{visitsLoading ? 'Carregando agenda…' : visitsError ? 'Agenda indisponível' : `${dayVisits.length} ${dayVisits.length === 1 ? 'visita na agenda' : 'visitas na agenda'}`}</span></div><div className="date-picker-wrap"><button className="icon-button date-arrow" onClick={() => { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate() - 1); selectCalendarDate(dayKey(d)) }} aria-label="Dia anterior"><ChevronLeft size={18} /></button><input type="date" value={selectedDate} onChange={e => selectCalendarDate(e.target.value)} aria-label="Selecionar dia" /><button className="icon-button date-arrow" onClick={() => { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate() + 1); selectCalendarDate(dayKey(d)) }} aria-label="Próximo dia"><ChevronRight size={18} /></button></div></section>
          {nextVisit && <section className="next-visit-card panel"><div className="next-visit-icon"><Clock3 size={20} /></div><div className="next-visit-copy"><span className="eyebrow">PRÓXIMA VISITA DE HOJE</span><strong>{nextVisit.NomePaciente || `Idoso #${nextVisit.CodCli}`}</strong><span>{new Date(nextVisit.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {nextVisit.Bairro || 'Bairro não informado'} · {nextVisit.Status === 'EM_ATENDIMENTO' ? 'Em atendimento' : `em ${Math.max(0, Math.ceil((new Date(nextVisit.DataHora).getTime() - clockNow.getTime()) / 60_000))} min`}</span></div><div className="next-visit-actions">{nextVisit.Status === 'CONFIRMADA' && <button className="primary small" onClick={() => startVisit(nextVisit.VisitaId)}>Iniciar atendimento</button>}{nextVisit.Status === 'PENDENTE' && <button className="secondary small" onClick={() => updateVisit(nextVisit.VisitaId, 'CONFIRMADA')}>Confirmar visita</button>}{nextVisit.Status === 'EM_ATENDIMENTO' && <button className="primary small" onClick={() => selectPatient(nextVisit.CodCli, nextVisit.VisitaId)}>Abrir atendimento</button>}</div></section>}
          <VisitCalendar month={calendarMonth} selectedDate={selectedDate} visits={visitsLoading || visitsError ? [] : visibleVisits} filterValue={neighborhoodFilter} filterOptions={regionOptions} onFilterChange={setNeighborhoodFilter} loading={visitsLoading} loadError={visitsError} onRetry={() => loadVisits().catch(e => setError(e instanceof Error ? e.message : 'Não foi possível atualizar a agenda.'))} onSelectDate={selectCalendarDate} onChangeMonth={changeCalendarMonth} onMoveVisit={moveVisit} onAddVisit={openNewBooking} />
          <div className="stats-row"><div className="stat-card"><div className="stat-symbol lavender"><CalendarDays size={19} /></div><div><span>NO DIA</span><strong>{dayVisits.length}</strong></div></div><div className="stat-card"><div className="stat-symbol mint"><Check size={19} /></div><div><span>CONFIRMADAS</span><strong>{dayVisits.filter(v => v.Status === 'CONFIRMADA').length}</strong></div></div><div className="stat-card"><div className="stat-symbol peach"><Clock3 size={19} /></div><div><span>AGUARDANDO</span><strong>{dayVisits.filter(v => v.Status === 'PENDENTE').length}</strong></div></div><div className="stat-card"><div className="stat-symbol rose"><HeartPulse size={19} /></div><div><span>REALIZADAS</span><strong>{dayVisits.filter(v => v.Status === 'REALIZADA').length}</strong></div></div></div>
          <section className="panel agenda-panel"><div className="panel-heading"><div><h2>Visitas do dia</h2><p>{prettyDate(new Date(`${selectedDate}T12:00:00`), { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><button className="secondary small" onClick={() => openNewBooking()}><Plus size={16} /> Nova visita</button></div>{visitsLoading ? <div className="empty-state"><span className="spinner" />Carregando visitas…</div> : visitsError ? <div className="empty-state" role="alert"><div className="empty-icon"><WifiOff size={22} /></div><strong>Agenda indisponível</strong><span>{visitsError}</span><button className="text-action" onClick={() => loadVisits().catch(e => setError(e instanceof Error ? e.message : 'Não foi possível atualizar a agenda.'))}>Tentar novamente <ChevronRight size={15} /></button></div> : dayVisits.length === 0 ? <div className="empty-state"><div className="empty-icon"><CalendarDays size={24} /></div><strong>Dia livre para cuidar</strong><span>Nenhuma visita agendada para esta data.</span><button className="text-action" onClick={() => openNewBooking()}>Agendar uma visita <ChevronRight size={15} /></button></div> : <div className="visit-list">{dayVisits.map(visit => { const address = addressQuery(visit.Endereco, visit.Bairro, visit.Cidade); return <article className="visit-row" key={visit.VisitaId}><div className="visit-time"><strong>{new Date(visit.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong><span>{visit.Status === 'REALIZADA' ? 'Atendida' : 'Visita'}</span></div><div className="timeline-rail"><span className={`rail-dot ${visit.Status.toLowerCase()}`} /></div><div className="visit-main"><button className="patient-link" onClick={() => selectPatient(visit.CodCli)}>{visit.NomePaciente || `Paciente ${visit.CodCli}`}<ChevronRight size={16} /></button><span className="visit-sub"><small className="neighborhood-badge">{neighborhoodLabel(visit.Bairro)}</small> · #{visit.CodCli}{isAdmin && visit.Enfermeira ? ` · ${visit.Enfermeira}` : ''}</span><span className={`status-pill ${visit.Status.toLowerCase()}`}>{statusLabels[visit.Status] || visit.Status}</span>{address && <span className="directions-links"><a href={mapsUrl(address)} target="_blank" rel="noreferrer"><MapPin size={14} />Google Maps</a><a href={wazeUrl(address)} target="_blank" rel="noreferrer"><MapPin size={14} />Waze</a></span>}</div><div className="visit-actions">{visit.Status === 'PENDENTE' && <button className="secondary small" onClick={() => updateVisit(visit.VisitaId, 'CONFIRMADA')}>Confirmar</button>}{visit.Status === 'CONFIRMADA' && <button className="primary small" onClick={() => startVisit(visit.VisitaId)}>Iniciar atendimento</button>}{visit.Status === 'EM_ATENDIMENTO' && <button className="primary small" onClick={() => selectPatient(visit.CodCli, visit.VisitaId)}>Registrar evolução</button>}{['PENDENTE','CONFIRMADA'].includes(visit.Status) && <button className="secondary small reschedule-button" onClick={() => openReschedule(visit)} title="Remarcar visita"><Pencil size={13} />Remarcar</button>}{visit.Status === 'PENDENTE' && <button className="icon-button" title="Cancelar visita" onClick={() => updateVisit(visit.VisitaId, 'CANCELADA')}><X size={17} /></button>}{visit.Status === 'REALIZADA' && <button className="secondary small" onClick={() => selectPatient(visit.CodCli)}>Ver prontuário</button>}</div></article> })}</div>}</section>
        </>}

        {view === 'pacientes' && <div className="patient-layout"><section className="patient-directory">
  <div className="page-heading compact"><div><span className="eyebrow">CUIDADO CONTÍNUO</span><h1>Atendimento clínico</h1><p>Busque o idoso para consultar a ficha e registrar o atendimento.</p></div></div>
  <div className="patient-search-wrap">
    <label className="search-box" htmlFor="patient-search"><Search size={17} aria-hidden="true" /><input id="patient-search" aria-label="Buscar idoso por nome, bairro ou código" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(patientSearch.trim())} aria-controls="patient-search-results" aria-activedescendant={filteredPatients.length ? `patient-option-${filteredPatients[activeSuggestion]?.id}` : undefined} onKeyDown={handlePatientSearchKeyDown} value={patientSearch} onChange={e => { setPatientSearch(e.target.value); setActiveSuggestion(0) }} placeholder="Buscar por nome, bairro ou código" /><span>{patientSearch.trim() ? `${filteredPatients.length}${filteredPatients.length === 8 ? '+' : ''}` : <Search size={14} aria-hidden="true" />}</span></label>
    {patientSearch.trim() ? <div className="directory-list autocomplete-results" id="patient-search-results" role="listbox" aria-label="Resultados da busca de idosos">
      {filteredPatients.map((item, index) => <button id={`patient-option-${item.id}`} role="option" aria-selected={activeSuggestion === index} className={`directory-item ${activeSuggestion === index ? 'suggestion-active' : ''}`} key={item.id} onMouseEnter={() => setActiveSuggestion(index)} onClick={() => selectPatient(item.id)}><div className="avatar patient-avatar">{initials(item.nome || item.razao || 'P')}</div><div className="directory-copy"><strong>{item.nome || item.razao}</strong><span><small className="neighborhood-badge">{neighborhoodLabel(item.bairro)}</small>{years(item.data_nascimento) ? ` · ${years(item.data_nascimento)} anos` : ''} · #{item.id}</span></div><ChevronRight size={16} /></button>)}
      {filteredPatients.length === 0 && <div className="directory-empty">{patientSearch.trim().length < 2 && !/^#?\d{1,10}$/.test(patientSearch.trim()) ? 'Digite ao menos 2 caracteres para pesquisar.' : loaded ? 'Nenhum idoso com escala ativa corresponde à busca.' : 'Carregando idosos…'}</div>}
      {filteredPatients.length === 8 && <div className="autocomplete-hint">Refine a busca para localizar outro idoso.</div>}
    </div> : <div className={`directory-prompt ${patient ? 'selected-patient-prompt' : ''}`}>{patient ? <><span className="directory-prompt-label">PACIENTE EM ATENDIMENTO</span><strong>{patient.nome || patient.razao}</strong><span>Ficha #{patient.id}{patient.bairro ? ` · ${patient.bairro}` : ''}</span></> : <><div className="empty-icon"><UsersRound size={21} /></div><strong>Encontre um idoso</strong><span>Digite o nome, bairro ou código no campo acima.</span></>}</div>}
  </div>
</section>
        <section className="patient-detail"><PatientWorkspace patient={patient} scale={patientScale} profile={medicalProfilePatientId === patient?.id ? medicalProfile : null} evolutions={evolutionsPatientId === patient?.id ? evolutions : []} form={form} setForm={updatePatientForm} saving={saving} draftState={draftState} onSave={event => saveEvolution(event, activeVisitId || undefined)} onToggle={toggleList} plan={carePlanPatientId === patient?.id ? carePlan : null} planVersions={carePlanPatientId === patient?.id ? carePlanVersions : []} planDraft={carePlanPatientId === patient?.id ? carePlanDraft : blankCarePlan} setPlanDraft={setCarePlanDraft} savingPlan={savingCarePlan} onSavePlan={saveCarePlan} /></section>
      </div>}
      {view === 'pendencias' && <PendingWorkspace items={notifications} isAdmin={isAdmin} onOpen={openNotification} />}
      {view === 'intercorrencias' && <IntercurrenceWorkspace patients={patients} initialPatientId={patient?.id} visitId={activeVisitId} isAdmin={isAdmin} />}
      {view === 'relatorios' && isAdmin && <ReportsWorkspace />}
      </div>
    </section>
    {completedSummary && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCompletedSummary('') }}><section className="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div className="modal-header"><div><span className="eyebrow">VISITA CONCLUÍDA</span><h2 id="summary-title">Resumo para compartilhar</h2><p>Confira as informações registradas antes de copiar ou abrir o WhatsApp.</p></div><button className="icon-button" onClick={() => setCompletedSummary('')} aria-label="Fechar resumo"><X size={19} /></button></div><pre className="summary-preview">{completedSummary}</pre><div className="modal-footer"><button type="button" className="secondary" onClick={() => setCompletedSummary('')}>Fechar</button><button type="button" className="secondary" onClick={copyCompletedSummary}>{summaryCopied ? <Check size={16} /> : <ClipboardList size={16} />}{summaryCopied ? 'Copiado' : 'Copiar resumo'}</button><a className="primary" href={`https://wa.me/?text=${encodeURIComponent(completedSummary)}`} target="_blank" rel="noreferrer">Abrir WhatsApp<ChevronRight size={16} /></a></div></section></div>}
    {bookingOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setBookingOpen(false); setBookingVisitId(null) } }}><section className="booking-modal booking-modal-grouped" role="dialog" aria-modal="true" aria-labelledby="booking-title"><div className="modal-header"><div><span className="eyebrow">ORGANIZAÇÃO DO CUIDADO</span><h2 id="booking-title">{bookingVisitId ? 'Remarcar visita' : 'Agendar visitas por bairro'}</h2><p>{bookingVisitId ? 'Escolha uma nova data e horário.' : 'Selecione idosos do mesmo bairro. Os horários avançam em intervalos de 90 minutos.'}</p></div><button className="icon-button" onClick={() => { setBookingOpen(false); setBookingVisitId(null) }} aria-label="Fechar"><X size={19} /></button></div><form onSubmit={createVisit}>
      {!bookingVisitId && <div className="booking-selection-workspace">
        <>
          <div className="booking-neighborhood-picker">
            <label htmlFor="booking-neighborhood-search">Bairro da visita</label>
            <div className={`booking-search-control ${bookingNeighborhood ? 'has-selection' : ''}`}>
              <Search size={17} aria-hidden="true" />
              <input id="booking-neighborhood-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded={bookingNeighborhoodOpen && bookingNeighborhoodSuggestions.length > 0} aria-controls="booking-neighborhood-suggestions" aria-activedescendant={bookingNeighborhoodOpen && bookingNeighborhoodSuggestions[activeBookingNeighborhoodSuggestion] ? `booking-neighborhood-option-${activeBookingNeighborhoodSuggestion}` : undefined} placeholder="Pesquise um bairro" value={bookingNeighborhood || bookingNeighborhoodSearch} readOnly={Boolean(bookingNeighborhood)} onFocus={() => setBookingNeighborhoodOpen(true)} onBlur={() => window.setTimeout(() => setBookingNeighborhoodOpen(false), 120)} onChange={event => { setBookingNeighborhoodSearch(event.target.value); setBookingNeighborhoodOpen(true); setActiveBookingNeighborhoodSuggestion(0) }} onKeyDown={handleBookingNeighborhoodKeyDown} />
              {bookingNeighborhood ? <button type="button" className="booking-clear-search" onMouseDown={event => event.preventDefault()} onClick={clearBookingNeighborhood} aria-label="Remover bairro selecionado"><X size={16} /></button> : <span className="booking-search-shortcut" aria-hidden="true">Buscar</span>}
            </div>
            {bookingNeighborhoodOpen && bookingNeighborhoodSuggestions.length > 0 && <div id="booking-neighborhood-suggestions" className="booking-suggestions" role="listbox" aria-label="Bairros disponíveis">{bookingNeighborhoodSuggestions.map((group, index) => <button id={`booking-neighborhood-option-${index}`} type="button" role="option" aria-selected={activeBookingNeighborhoodSuggestion === index} className={`booking-suggestion ${activeBookingNeighborhoodSuggestion === index ? 'active' : ''}`} key={neighborhoodKey(group.neighborhood)} onMouseEnter={() => setActiveBookingNeighborhoodSuggestion(index)} onMouseDown={event => event.preventDefault()} onClick={() => chooseBookingNeighborhood(group.neighborhood)}><span><strong>{group.neighborhood}</strong><small>{group.patients.length} {group.patients.length === 1 ? 'idoso' : 'idosos'} com escala ativa</small></span><ChevronRight size={16} /></button>)}</div>}
            {bookingNeighborhood && <p className="booking-field-hint">{bookingCandidatesLoading ? 'Buscando idosos com escala ativa neste bairro…' : selectedBookingGroup?.patients.length ? `${selectedBookingGroup.patients.length} idosos encontrados neste bairro. Pesquise pelo nome, código ou CPF para refinar.` : 'Pesquise idosos com escala ativa neste bairro pelo nome, código ou CPF.'}</p>}
            {!bookingNeighborhood && !bookingNeighborhoodSearch.trim() && <p className="booking-field-hint">Digite o bairro para localizar idosos com escala ativa.</p>}
            {!bookingNeighborhood && bookingNeighborhoodSearch.trim() && bookingCandidatesLoading && <p className="booking-field-hint">Buscando bairros com idosos elegíveis…</p>}
            {!bookingNeighborhood && bookingNeighborhoodSearch.trim() && !bookingNeighborhoodSuggestions.length && <p className="booking-field-hint">Nenhum bairro encontrado para “{bookingNeighborhoodSearch.trim()}”.</p>}
          </div>
          {bookingNeighborhood && selectedBookingGroup && <div className="booking-patient-picker">
            <label htmlFor="booking-patient-search">Idoso <span>Nome, código ou CPF</span></label>
            <div className="booking-search-control booking-patient-search">
              <Search size={17} aria-hidden="true" />
              <input id="booking-patient-search" type="text" autoComplete="off" placeholder="Busque pelo nome, código ou CPF" value={bookingPatientSearch} onChange={event => setBookingPatientSearch(event.target.value)} />
              {bookingPatientSearch && <button type="button" className="booking-clear-search" onClick={() => setBookingPatientSearch('')} aria-label="Limpar busca de idoso"><X size={16} /></button>}
            </div>
            {bookingPatientSearch.trim() && <div className="booking-patient-results" aria-label="Resultados da busca de idosos">{bookingCandidatesLoading ? <div className="booking-no-results">Pesquisando idosos com escala ativa…</div> : bookingGroupPatients.length ? bookingGroupPatients.map(item => { const id = String(item.id); const checked = bookingPatients.includes(id); return <label className={`booking-patient-option ${checked ? 'selected' : ''}`} key={id}><input type="checkbox" checked={checked} onChange={() => toggleBookingPatient(id, selectedBookingGroup.neighborhood)} /><span><strong>{bookingPatientLabel(item)}</strong><small>Ficha #{item.id}{years(item.data_nascimento) ? ` · ${years(item.data_nascimento)} anos` : ''}</small></span></label>}) : <div className="booking-no-results">Nenhum idoso encontrado com esse nome, código ou CPF neste bairro.</div>}</div>}
            {!bookingPatientSearch.trim() && <p className="booking-field-hint">Pesquise para localizar idosos com escala ativa neste bairro.</p>}
          </div>}
          {bookingPatients.length > 0 && <div className="booking-selected-patients"><div className="booking-selected-heading"><strong>Selecionados</strong><span>{bookingPatients.length}</span></div>{bookingPatients.map(id => { const item = getBookingPatient(id); const label = item ? bookingPatientLabel(item) : `Idoso #${id}`; return <div className="booking-selected-patient" key={id}><span><strong>{label}</strong><small>Ficha #{id}{item && years(item.data_nascimento) ? ` · ${years(item.data_nascimento)} anos` : ''}</small></span><button type="button" className="booking-clear-search" onClick={() => toggleBookingPatient(id, bookingNeighborhood)} aria-label={`Remover ${label}`}><X size={16} /></button></div>})}</div>}
        </>
      </div>}
      {bookingVisitId && <div className="booking-date-readonly"><CalendarDays size={15} />{(() => { const item = getBookingPatient(bookingPatient); return item ? bookingPatientLabel(item) : `Idoso #${bookingPatient}` })()}</div>}
      {isAdmin && !bookingVisitId && <label className="input-field admin-nurse-field"><span>Enfermeira responsável</span><div className="select-wrap"><select value={bookingNurse} onChange={event => setBookingNurse(event.target.value)} required><option value="">Selecione uma enfermeira habilitada</option>{nurses.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><ChevronDown size={15} /></div></label>}
      <div className="booking-fields"><label className="input-field"><span>Data da visita</span><input type="date" value={bookingDate} onChange={event => changeBookingDate(event.target.value)} min={dayKey(new Date())} required /></label><label className="input-field"><span>{bookingVisitId || bookingSelection.length <= 1 ? 'Horário' : 'Primeiro horário'}</span><input type="time" value={bookingTime} onChange={event => setBookingTime(event.target.value)} min={bookingDate === dayKey(new Date()) ? currentLocalTime() : undefined} required /></label></div>
      {!bookingVisitId && bookingSelection.length > 1 && <div className="booking-sequence"><strong>{bookingSelection.length} visitas · {bookingNeighborhood}</strong>{bookingSelection.map((id, index) => { const item = getBookingPatient(id); const slot = batchTimeSlots[index]; return <div key={id}><span>{index + 1}. {item ? bookingPatientLabel(item) : `Idoso #${id}`}</span><time>{slot && slot.date === bookingDate ? slot.time : 'Fora do dia'}</time></div> })}<small>Intervalo sugerido de 90 minutos entre cada visita.</small></div>}
      {!bookingVisitId && bookingSelection.length === 0 && <p className="booking-help">Busque um bairro e, em seguida, pesquise e selecione um ou mais idosos com escala ativa.</p>}
      <div className="modal-footer"><button type="button" className="secondary" onClick={() => { setBookingOpen(false); setBookingVisitId(null) }}>Voltar</button><button className="primary" disabled={bookingVisitId ? !bookingPatient : !bookingSelection.length || (isAdmin && !bookingNurse) || batchTimeSlots.some(slot => slot.date !== bookingDate)}><CalendarDays size={16} />{bookingVisitId ? 'Salvar novo horário' : bookingSelection.length > 1 ? `Agendar ${bookingSelection.length} visitas` : 'Adicionar à agenda'}</button></div>
    </form></section></div>}
  </main>
}

