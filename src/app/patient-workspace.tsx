'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, HeartPulse, MapPin, Star, Stethoscope, TrendingUp, UserRound } from 'lucide-react'
import type { CarePlan, CarePlanDraft } from './care-plan-workspace'
import ClinicalEvolutionForm from './clinical-evolution-form'

type Patient = { id: number; nome?: string; razao?: string; data_nascimento?: string; sexo?: string; segmento?: string; telefone?: string; celular?: string; endereco?: string; bairro?: string; cidade?: string; responsavel_nome?: string }
type Scale = { id: number; status?: string; contratante?: string; dataInicio?: string; dataFim?: string; responsavel?: string | null; cuidadores?: { id: number; nome: string }[] }
type Profile = { MotivoConsulta?: string; Patologias?: string; OutrosPatologias?: string; HistoricoFamiliar?: string; FichaAnamnese_Medicamento?: { MedicamentoId: number; Nome?: string; Dose?: string; Horarios?: string }[] }
type Evolution = { EvolucaoId: number; DataHora: string; Enfermeira?: string; PressaoArterial?: string; Spo2?: string; FrequenciaCardiaca?: string; Temperatura?: string; FrequenciaRespiratoria?: string; Hgt?: string; Consciencia?: string; CondicaoGeral?: string; Pele?: string; Observacoes?: string; PossuiLpp?: string; LocalizacaoLpp?: string; GrauLpp?: string; Curativos?: string; Lesoes?: string; Satisfacao?: string; SatisfacaoMonitoramentoSemana?: number | null; SatisfacaoMonitoramentoFimSemana?: number | null; SatisfacaoEquipeManha?: number | null; SatisfacaoEquipeTarde?: number | null; SatisfacaoMonitoramentoComunicacao?: number | null; SatisfacaoSuporteEnfermagem?: number | null; SatisfacaoCuidadoresDia?: number | null; SatisfacaoCuidadoresNoite?: number | null }
type Form = { pa: string; spo2: string; fc: string; temperatura: string; fr: string; hgt: string; consciencia: string; condicaoGeral: string; pele: string[]; observacoes: string; lpp: string; localizacaoLpp: string; grauLpp: string; curativos: string[]; lesoes: string; satisfacao: string; satisfacaoMonitoramentoComunicacao: number; satisfacaoSuporteEnfermagem: number; satisfacaoCuidadoresDia: number; satisfacaoCuidadoresNoite: number }

function parseStoredList(value?: string): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [value]
  } catch {
    return [value]
  }
}

const vitalMetrics = [
  { key: 'PressaoArterial', label: 'Pressão sistólica', unit: 'mmHg', read: (value?: string) => { const match = value?.match(/^\s*(\d+(?:[.,]\d+)?)/); return match ? Number(match[1].replace(',', '.')) : null } },
  { key: 'Spo2', label: 'SpO₂', unit: '%', read: (value?: string) => numericVital(value) },
  { key: 'FrequenciaCardiaca', label: 'Frequência cardíaca', unit: 'bpm', read: (value?: string) => numericVital(value) },
  { key: 'Temperatura', label: 'Temperatura', unit: '°C', read: (value?: string) => numericVital(value) },
  { key: 'FrequenciaRespiratoria', label: 'Frequência respiratória', unit: 'irpm', read: (value?: string) => numericVital(value) },
  { key: 'Hgt', label: 'HGT', unit: 'mg/dL', read: (value?: string) => numericVital(value) },
] as const

function numericVital(value?: string) {
  if (!value) return null
  const match = value.replace(',', '.').match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function VitalTrend({ evolutions }: { evolutions: Evolution[] }) {
  const [metricKey, setMetricKey] = useState<(typeof vitalMetrics)[number]['key']>('PressaoArterial')
  const metric = vitalMetrics.find(item => item.key === metricKey) || vitalMetrics[0]
  const points = useMemo(() => evolutions.slice(0, 12).reverse().flatMap(row => {
    const value = metric.read(row[metric.key] as string | undefined)
    return value === null || !Number.isFinite(value) ? [] : [{ date: row.DataHora, value }]
  }), [evolutions, metric])
  const min = points.length ? Math.min(...points.map(point => point.value)) : 0
  const max = points.length ? Math.max(...points.map(point => point.value)) : 1
  const span = max - min || Math.max(1, Math.abs(max) * .12)
  const coords = points.map((point, index) => ({ ...point, x: points.length === 1 ? 360 : 42 + index * (636 / (points.length - 1)), y: 24 + (1 - (point.value - (min - span * .12)) / (span * 1.24)) * 132 }))
  const path = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ')
  const gridLabels = [max, min + span / 2, min].map(value => Number(value.toFixed(1)))
  return <section className="panel vital-trend-panel" aria-labelledby="vital-trend-title">
    <div className="panel-heading"><div><div className="flex items-center gap-2"><TrendingUp size={18} className="text-[var(--brand)]" /><h2 id="vital-trend-title">Evolução dos sinais</h2></div><p>Leituras registradas nas últimas 12 evoluções disponíveis.</p></div><span className="history-count">{points.length} {points.length === 1 ? 'leitura' : 'leituras'}</span></div>
    {points.length ? <>
      <div className="vital-trend-tabs" role="tablist" aria-label="Selecionar sinal vital">
        {vitalMetrics.map(item => <button key={item.key} type="button" role="tab" aria-selected={metricKey === item.key} className={metricKey === item.key ? 'active' : ''} onClick={() => setMetricKey(item.key)}>{item.label}</button>)}
      </div>
      <div className="vital-trend-chart"><svg viewBox="0 0 720 198" role="img" aria-label={`${metric.label}: ${points.length} leituras ao longo do tempo`}>
        {[30, 96, 162].map(y => <line key={y} x1="42" y1={y} x2="678" y2={y} className="vital-trend-grid" />)}
        {gridLabels.map((label, index) => <text key={index} x="4" y={34 + index * 66} className="vital-trend-label">{label}</text>)}
        {coords.length > 1 && <path d={path} className="vital-trend-line" />}
        {coords.map((point, index) => <g key={`${point.date}-${index}`}><circle cx={point.x} cy={point.y} r="5" className="vital-trend-dot"><title>{`${new Date(point.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}: ${point.value} ${metric.unit}`}</title></circle>{(index === 0 || index === coords.length - 1 || index % 3 === 0) && <text x={point.x} y="190" textAnchor="middle" className="vital-trend-date">{new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</text>}</g>)}
      </svg></div>
      <p className="vital-trend-caption">{metric.label} · {metric.unit}. Visualização de registros; interprete junto ao contexto clínico do paciente.</p>
    </> : <div className="history-empty"><div className="empty-icon"><HeartPulse size={21} /></div><span>Ainda não há leituras suficientes para este gráfico.</span></div>}
  </section>
}

export default function PatientWorkspace({ patient, scale, profile, evolutions, form, setForm, saving, draftState, onSave, onToggle, plan, planVersions, planDraft, setPlanDraft, savingPlan, onSavePlan }: {
  patient: Patient | null; scale?: Scale; profile: Profile | null; evolutions: Evolution[]; form: Form; setForm: (form: Form) => void; saving: boolean; draftState: 'clean' | 'loading' | 'saving' | 'saved' | 'error';
  onSave: (event: React.FormEvent) => void; onToggle: (field: 'pele' | 'curativos', value: string) => void
  plan: CarePlan | null; planVersions: CarePlan[]; planDraft: CarePlanDraft; setPlanDraft: (draft: CarePlanDraft) => void; savingPlan: boolean; onSavePlan: (event: React.FormEvent) => void
}) {
  if (!patient) return <div className="select-patient-empty"><div className="empty-icon"><UserRound size={25} /></div><strong>Escolha um paciente</strong><span>Selecione um nome na lista para consultar os dados e registrar uma evolução.</span></div>
  const name = patient.nome || patient.razao || 'Paciente'
  const navigationAddress = [patient.endereco, patient.bairro, patient.cidade].filter(Boolean).join(', ')
  const birthDate = patient.data_nascimento ? new Date(`${patient.data_nascimento.slice(0, 10)}T12:00:00`) : null
  let age = birthDate && !Number.isNaN(birthDate.getTime()) ? new Date().getFullYear() - birthDate.getFullYear() : null
  if (age !== null && birthDate) {
    const now = new Date()
    if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) age--
  }
  return <>
    <details className="patient-profile panel">
      <summary className="profile-summary">
        <div className="profile-heading"><div className="avatar profile-avatar">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div><div className="profile-name"><span className="eyebrow">FICHA DO PACIENTE · #{patient.id}</span><h2>{name}</h2><p>{patient.segmento || 'Idoso'}{age !== null ? ` · ${age} anos` : ''}{patient.bairro ? ` · ${patient.bairro}` : ''}{patient.cidade ? `, ${patient.cidade}` : ''}</p></div><span className="active-tag"><span className="online-dot" /> {scale ? 'Escala ativa' : 'Sem escala ativa'}</span><span className="profile-expand" aria-hidden="true"><ChevronDown size={18} /><span className="expand-open">Ver ficha completa</span><span className="expand-close">Recolher ficha</span></span></div>
      </summary>
      <div className="profile-expanded">
      <div className="profile-facts"><div><span>NASCIMENTO</span><strong>{patient.data_nascimento ? new Date(`${patient.data_nascimento.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'}{patient.sexo ? ` · ${patient.sexo}` : ''}</strong></div><div><span>CONTATO</span><strong>{patient.celular || patient.telefone || 'Não informado'}</strong></div><div><span>ENDEREÇO</span><strong>{[patient.endereco, patient.bairro, patient.cidade].filter(Boolean).join(', ') || 'Não informado'}</strong></div><div><span>RESPONSÁVEL</span><strong>{patient.responsavel_nome || 'Não informado'}</strong></div></div>
      {navigationAddress && <nav className="patient-navigation-links" aria-label="Abrir endereço do paciente"><span>COMO CHEGAR</span><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationAddress)}`} target="_blank" rel="noreferrer"><MapPin size={15} />Google Maps</a><a href={`https://waze.com/ul?q=${encodeURIComponent(navigationAddress)}&navigate=yes`} target="_blank" rel="noreferrer"><MapPin size={15} />Waze</a></nav>}
      <div className="scale-facts"><div className="scale-heading"><div><span className="eyebrow">VÍNCULO DE ATENDIMENTO</span><strong>Escala do paciente</strong></div><span className={`scale-status ${scale ? 'active' : 'inactive'}`}><i />{scale ? 'Escala ativa' : 'Sem escala ativa'}</span></div>{scale ? <div className="scale-facts-grid"><div><span>Nº DA ESCALA</span><strong>#{scale.id}</strong></div><div><span>CONTRATANTE</span><strong>{scale.contratante || 'Não informado'}</strong></div><div><span>RESPONSÁVEL CADASTRADO</span><strong>{patient.responsavel_nome || 'Não informado'}</strong></div><div><span>PERÍODO DA ESCALA</span><strong>{[scale.dataInicio, scale.dataFim].filter(Boolean).join(' até ') || 'Não informado'}</strong></div><div><span>EQUIPE RESPONSÁVEL</span><strong>{scale.responsavel || scale.cuidadores?.map(item => item.nome).filter(Boolean).join(', ') || 'Não informado'}</strong></div></div> : <p className="scale-empty">Este paciente não tem uma escala ativa vinculada no momento.</p>}</div>
      {(profile?.MotivoConsulta || profile?.Patologias || profile?.HistoricoFamiliar || profile?.FichaAnamnese_Medicamento?.length) && <div className="medical-context"><span className="eyebrow">CONTEXTO DE SAÚDE</span><div className="medical-context-grid">{profile.MotivoConsulta && <div><span>MOTIVO DO CUIDADO</span><strong>{profile.MotivoConsulta}</strong></div>}{profile.Patologias && <div><span>PATOLOGIAS / ALERGIAS</span><strong>{profile.Patologias}{profile.OutrosPatologias ? ` · ${profile.OutrosPatologias}` : ''}</strong></div>}{profile.HistoricoFamiliar && <div><span>HISTÓRICO FAMILIAR</span><strong>{profile.HistoricoFamiliar}</strong></div>}{!!profile.FichaAnamnese_Medicamento?.length && <div><span>MEDICAMENTOS DE USO</span><strong>{profile.FichaAnamnese_Medicamento.map(item => [item.Nome, item.Dose, item.Horarios].filter(Boolean).join(' · ')).join(' / ')}</strong></div>}</div></div>}
      </div>
    </details>
    {draftState === 'loading' ? <section className="panel p-6" role="status"><span className="spinner" /> Recuperando o rascunho protegido deste paciente…</section> : <ClinicalEvolutionForm form={form} setForm={setForm} saving={saving} draftState={draftState} onSave={onSave} onToggle={onToggle} patientName={name} patientId={patient.id} plan={plan} planVersions={planVersions} planDraft={planDraft} setPlanDraft={setPlanDraft} savingPlan={savingPlan} onSavePlan={onSavePlan} latestEvolution={evolutions[0]} />}
    <VitalTrend evolutions={evolutions} />
    <section className="panel history-panel"><div className="panel-heading"><div><h2>Histórico clínico</h2><p>Registros anteriores deste paciente.</p></div><span className="history-count">{evolutions.length} {evolutions.length === 1 ? 'registro' : 'registros'}</span></div>{evolutions.length ? <div className="history-list">{evolutions.map(item => { const skin = parseStoredList(item.Pele); const dressings = parseStoredList(item.Curativos); const legacyRatings = ([['Monitoramento · dia de semana', item.SatisfacaoMonitoramentoSemana], ['Monitoramento · fim de semana', item.SatisfacaoMonitoramentoFimSemana], ['Equipe · manhã', item.SatisfacaoEquipeManha], ['Equipe · tarde', item.SatisfacaoEquipeTarde]] as const).filter(([,score]) => Number(score) > 0); return <article className="history-item" key={item.EvolucaoId}><div className="history-marker"><Stethoscope size={16} /></div><div className="history-content"><div className="history-meta"><strong>{new Date(item.DataHora).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><span>{new Date(item.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {item.Enfermeira || 'Equipe clínica'}</span></div><div className="history-vitals">{[['PA',item.PressaoArterial],['SpO₂',item.Spo2 && `${item.Spo2}%`],['FC',item.FrequenciaCardiaca && `${item.FrequenciaCardiaca} bpm`],['Temp.',item.Temperatura && `${item.Temperatura} °C`],['FR',item.FrequenciaRespiratoria && `${item.FrequenciaRespiratoria} irpm`],['HGT',item.Hgt]].filter(([,value]) => value).map(([label,value]) => <span key={String(label)}><small>{label}</small><strong>{value}</strong></span>)}</div><div className="history-tags">{[item.Consciencia,item.CondicaoGeral,...skin,...dressings].filter(Boolean).map((value,index) => <span key={`${value}-${index}`}>{value}</span>)}</div>{item.Observacoes && <p className="history-note">{item.Observacoes}</p>}{(item.PossuiLpp === 'Sim' || item.Lesoes) && <p className="history-note">{[item.PossuiLpp === 'Sim' && `LPP: ${item.LocalizacaoLpp || 'sim'} ${item.GrauLpp ? `· ${item.GrauLpp}` : ''}`,item.Lesoes].filter(Boolean).join(' · ')}</p>}{item.Satisfacao && <p className="history-note">Comentário do contratante: {item.Satisfacao}</p>}<div className="history-ratings">{([['Monitoramento & Comunicação', item.SatisfacaoMonitoramentoComunicacao], ['Suporte da Enfermagem', item.SatisfacaoSuporteEnfermagem], ['Cuidadores · dia', item.SatisfacaoCuidadoresDia], ['Cuidadores · noite', item.SatisfacaoCuidadoresNoite]] as const).filter(([,score]) => Number(score) > 0).map(([label,score]) => <span key={label}>{label}: <Star size={12} fill="currentColor" /> {score}/5</span>)}</div>{legacyRatings.length > 0 && <div className="history-ratings legacy-ratings"><small>Formulário anterior</small>{legacyRatings.map(([label,score]) => <span key={label}>{label}: <Star size={12} fill="currentColor" /> {score}/5</span>)}</div>}</div></article> })}</div> : <div className="history-empty"><div className="empty-icon"><HeartPulse size={22} /></div><span>As evoluções salvas aparecerão aqui.</span></div>}</section>
  </>
}

