'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Droplet, HeartPulse, History, Info, ShieldAlert, ShieldCheck, Star, Stethoscope, Thermometer, UserRound, Wind, X } from 'lucide-react'
import CarePlanWorkspace, { type CarePlan, type CarePlanDraft } from './care-plan-workspace'

type ClinicalForm = {
  pa: string; spo2: string; fc: string; temperatura: string; fr: string; hgt: string
  consciencia: string; condicaoGeral: string; pele: string[]; observacoes: string
  lpp: string; localizacaoLpp: string; grauLpp: string; curativos: string[]; lesoes: string
  satisfacao: string; satisfacaoMonitoramentoComunicacao: number; satisfacaoSuporteEnfermagem: number
  satisfacaoCuidadoresDia: number; satisfacaoCuidadoresNoite: number
}

type LatestEvolution = { EvolucaoId: number; DataHora: string; Enfermeira?: string; PressaoArterial?: string; Spo2?: string; FrequenciaCardiaca?: string; Temperatura?: string; FrequenciaRespiratoria?: string; Hgt?: string; Consciencia?: string; CondicaoGeral?: string; Pele?: string; Observacoes?: string; PossuiLpp?: string; LocalizacaoLpp?: string; GrauLpp?: string; Curativos?: string; Lesoes?: string }

const steps = [
  { title: 'Sinais vitais', mobileTitle: 'Sinais', description: 'Registre as medidas aferidas.' },
  { title: 'Avaliação geral', mobileTitle: 'Geral', description: 'Descreva como o paciente está.' },
  { title: 'Pele e curativos', mobileTitle: 'Pele', description: 'Registre lesões e cuidados realizados.' },
  { title: 'Plano de cuidado', mobileTitle: 'Plano', description: 'Revise as orientações contínuas do paciente.' },
  { title: 'Satisfação', mobileTitle: 'Satisf.', description: 'Avalie o cuidado e registre comentários.' },
]

function ChoiceFieldset({ legend, options, value, onChange, multiple = false }: {
  legend: string
  options: string[]
  value: string | string[]
  onChange: (value: string) => void
  multiple?: boolean
}) {
  const legendIcons = {
    'Nível de consciência': Brain,
    'Condição geral': HeartPulse,
    'Aspecto da pele': ShieldCheck,
    'Lesão por pressão (LPP)': ShieldAlert,
    'Cuidados realizados': ClipboardCheck,
  }
  const LegendIcon = legendIcons[legend as keyof typeof legendIcons]
  return <fieldset className={`choice-field ${multiple ? 'multiple-choice' : ''}`}>
    <legend>{LegendIcon && <LegendIcon size={16} aria-hidden="true" />}<span>{legend}</span></legend>
    {!multiple && <span className="choice-hint">Clique novamente na opção marcada para limpar a seleção.</span>}
    <div className="choice-grid">{options.map(option => {
      const checked = Array.isArray(value) ? value.includes(option) : value === option
      const nextValue = !multiple && !Array.isArray(value) && value === option ? '' : option
      return <label className={`choice-card ${checked ? 'selected' : ''}`} key={option}>
        <input type={multiple ? 'checkbox' : 'radio'} name={legend} checked={checked} onClick={event => { if (!multiple && checked) { event.preventDefault(); onChange('') } }} onChange={() => onChange(nextValue)} />
        <span className="choice-indicator" aria-hidden="true">{checked && <Check size={14} strokeWidth={2.5} />}</span>
        <span className="choice-card-label">{option}</span>
      </label>
    })}</div>
  </fieldset>
}

export default function ClinicalEvolutionForm({ form, setForm, saving, draftState, onSave, onToggle, patientName, patientId, plan, planVersions, planDraft, setPlanDraft, savingPlan, onSavePlan, latestEvolution }: {
  form: ClinicalForm
  setForm: (form: ClinicalForm) => void
  saving: boolean
  draftState: 'clean' | 'loading' | 'saving' | 'saved' | 'error'
  onSave: (event: React.FormEvent) => void
  onToggle: (field: 'pele' | 'curativos', value: string) => void
  patientName: string
  patientId: number
  plan: CarePlan | null
  planVersions: CarePlan[]
  planDraft: CarePlanDraft
  setPlanDraft: (draft: CarePlanDraft) => void
  savingPlan: boolean
  onSavePlan: (event: React.FormEvent) => void
  latestEvolution?: LatestEvolution
}) {
  const [step, setStep] = useState(0)
  const [latestOpen, setLatestOpen] = useState(false)
  const wasSaving = useRef(false)

  useEffect(() => {
    setStep(0)
  }, [patientId])

  useEffect(() => {
    if (saving) {
      wasSaving.current = true
      return
    }
    if (!wasSaving.current) return
    wasSaving.current = false
    const isBlank = Object.values(form).every(value => Array.isArray(value) ? value.length === 0 : value === '' || value === 0)
    if (isBlank) setStep(0)
  }, [saving, form])

  function update<K extends keyof ClinicalForm>(key: K, value: ClinicalForm[K]) {
    setForm({ ...form, [key]: value })
  }

  function vitalAlert(key: string, raw: string) {
    if (!raw.trim()) return null
    const number = Number(raw.replace(',', '.').match(/[+-]?\d+(?:\.\d+)?/)?.[0])
    if (!Number.isFinite(number)) return null
    if (key === 'pa') {
      const systolic = Number(raw.match(/^\s*(\d+)/)?.[1])
      if (!Number.isFinite(systolic)) return null
      if (systolic > 180) return { level: 'critical', message: 'Pressão sistólica muito elevada. Siga o protocolo clínico e reavalie.' }
      if (systolic >= 140 || systolic <= 90) return { level: 'attention', message: 'Pressão fora da faixa de referência definida. Considere o histórico e protocolo do paciente.' }
    }
    if (key === 'spo2' && number < 92) return { level: 'critical', message: 'SpO₂ abaixo de 92%. Confirme a aferição e siga o protocolo clínico.' }
    if (key === 'spo2' && number < 95) return { level: 'attention', message: 'SpO₂ abaixo de 95%. Considere a linha de base e o quadro clínico do paciente.' }
    if (key === 'hgt' && number <= 70) return { level: 'critical', message: 'HGT igual ou abaixo de 70 mg/dL. Siga o protocolo clínico.' }
    if (key === 'hgt' && number >= 180) return { level: 'attention', message: 'HGT igual ou acima de 180 mg/dL. Considere o plano clínico do paciente.' }
    return null
  }

  function parseList(raw?: string) {
    if (!raw) return []
    try { const parsed: unknown = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : [raw] } catch { return [raw] }
  }

  function navigateTabs(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : (step + (event.key === 'ArrowRight' ? 1 : -1) + steps.length) % steps.length
    setStep(next)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return <section className="panel evolution-panel">
    <div className="panel-heading evolution-heading flex flex-wrap items-start gap-3 sm:items-center">
      <div><span className="eyebrow">ATENDIMENTO CLÍNICO</span><h2>Nova evolução</h2><p>Registre os achados do atendimento em cinco etapas.</p></div>
      <div className="evolution-heading-meta"><span className="patient-context"><UserRound size={15} /><span>{patientName}</span><small>#{patientId}</small></span><span className="record-tag"><ShieldCheck size={15} /> Registro clínico</span><span className={`draft-status-chip ${draftState}`} role="status">{draftState === 'saving' ? 'Salvando rascunho…' : draftState === 'saved' ? 'Rascunho protegido salvo' : draftState === 'error' ? 'Falha ao salvar rascunho' : 'Rascunho protegido'}</span><button type="button" className="history-peek-button" disabled={!latestEvolution} onClick={() => setLatestOpen(true)}><History size={15} />{latestEvolution ? 'Ver última evolução' : 'Sem evolução anterior'}</button></div>
    </div>
    <div className="evolution-progress" aria-label={`Etapa ${step + 1} de ${steps.length}`}>
      <div className="evolution-progress-copy"><span>PROGRESSO DO REGISTRO</span><strong>Etapa {step + 1} de {steps.length}</strong></div>
      <div className="evolution-progress-track" aria-hidden="true"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      <div className="evolution-tabs" role="tablist" aria-label="Etapas da evolução clínica" onKeyDown={navigateTabs}>
        {steps.map((item, index) => <button key={item.title} type="button" role="tab" tabIndex={step === index ? 0 : -1} id={`evolution-tab-${index}`} aria-selected={step === index} aria-controls="evolution-panel-content" className={step === index ? 'active' : ''} onClick={() => setStep(index)}>
          <span className="evolution-tab-number">{`0${index + 1}`}</span><span className="evolution-tab-title">{item.title}</span><span className="evolution-tab-mobile-title" aria-hidden="true">{item.mobileTitle}</span>
        </button>)}
      </div>
    </div>
      {step === 3 && <div className="evolution-care-plan" role="tabpanel" id="evolution-panel-content" aria-labelledby="evolution-tab-3">
        <CarePlanWorkspace plan={plan} versions={planVersions} draft={planDraft} setDraft={setPlanDraft} saving={savingPlan} onSave={onSavePlan} />
        <div className="form-footer evolution-footer"><span className="evolution-save-context">O plano é salvo como uma versão separada.</span><div className="evolution-actions"><button type="button" className="secondary" onClick={() => setStep(2)}><ChevronLeft size={17} />Voltar</button><button type="button" className="primary" onClick={() => setStep(4)}>Próximo<ChevronRight size={17} /></button></div></div>
      </div>}
      {step !== 3 && <form onSubmit={onSave}>
        <div className="evolution-step-content" id="evolution-panel-content" role="tabpanel" aria-labelledby={`evolution-tab-${step}`} key={step}>
        {step === 0 && <div className="form-section">
          <div className="vitals-section-heading"><div className="form-section-title"><span className="section-accent" aria-hidden="true" /><div><strong>Sinais vitais</strong><span>{steps[0]!.description}</span></div></div><div className="vitals-tip"><Info size={16} />Registre os sinais vitais mais recentes do paciente.</div></div>
          <div className="vitals-grid">{([['pa','Pressão arterial','Registre a pressão sistólica e diastólica.','Ex.: 120/80','text',undefined,Stethoscope],['spo2','SpO₂','Saturação periférica de oxigênio.','Ex.: 97','number','%',Wind],['fc','Frequência cardíaca','Registre os batimentos por minuto.','Ex.: 72','number','bpm',HeartPulse],['temperatura','Temperatura','Registre a temperatura corporal.','Ex.: 36,5','number','°C',Thermometer],['fr','Frequência respiratória','Registre as incursões respiratórias.','Ex.: 16','number','irpm',Wind],['hgt','HGT','Registre a glicemia capilar.','Ex.: 110','number','mg/dL',Droplet]] as const).map(([key,label,description,placeholder,type,unit,Icon]) => { const alert = (key === 'pa' || key === 'spo2' || key === 'hgt') ? vitalAlert(key, form[key]) : null; return <label className={`input-field vital-field ${alert ? `has-vital-alert ${alert.level}` : ''}`} key={key}><span className="vital-card-heading"><span className="vital-icon"><Icon size={23} /></span><span className="vital-copy"><strong>{label}</strong><small>{description}</small></span></span><div className="input-with-unit"><input type={type} step={key === 'temperatura' ? '0.1' : undefined} min={type === 'number' ? 0 : undefined} inputMode={key === 'pa' ? 'text' : key === 'temperatura' ? 'decimal' : 'numeric'} placeholder={placeholder} value={form[key]} aria-describedby={alert ? `alert-${key}` : undefined} onChange={event => update(key, event.target.value)} />{unit && <em>{unit}</em>}</div>{alert && <small className="vital-alert" id={`alert-${key}`} role="status"><Activity size={13} />{alert.message}</small>}</label> })}</div>
        </div>}
        {step === 1 && <div className="form-section">
          <div className="step-section-heading"><span className="step-section-icon"><Activity size={22} /></span><div><strong>Avaliação geral</strong><span>{steps[1]!.description}</span></div></div>
          <ChoiceFieldset legend="Nível de consciência" options={['Lúcido','Sonolento','Desorientado','Inconsciente']} value={form.consciencia} onChange={value => update('consciencia', value)} />
          <ChoiceFieldset legend="Condição geral" options={['Ótima','Boa','Regular','Crítica']} value={form.condicaoGeral} onChange={value => update('condicaoGeral', value)} />
          <ChoiceFieldset legend="Aspecto da pele" options={['Hidratada','Desidratada','Ictérica','Cianótica','Edema']} value={form.pele} onChange={value => onToggle('pele', value)} multiple />
          <label className="input-field full-field"><span>Observações da avaliação</span><textarea rows={3} value={form.observacoes} onChange={event => update('observacoes', event.target.value)} placeholder="Comportamento, queixas relatadas, intercorrências…" /></label>
        </div>}
        {step === 2 && <div className="form-section">
          <div className="step-section-heading"><span className="step-section-icon"><ShieldCheck size={22} /></span><div><strong>Pele e curativos</strong><span>{steps[2]!.description}</span></div></div>
          <ChoiceFieldset legend="Lesão por pressão (LPP)" options={['Não','Sim']} value={form.lpp} onChange={value => update('lpp', value)} />
          {form.lpp === 'Sim' && <div className="lpp-grid"><label className="input-field"><span>Localização</span><input value={form.localizacaoLpp} onChange={event => update('localizacaoLpp', event.target.value)} placeholder="Ex.: sacra, calcâneo" /></label><label className="input-field"><span>Grau</span><div className="select-wrap"><select value={form.grauLpp} onChange={event => update('grauLpp', event.target.value)}><option value="">Selecione o grau</option>{['Grau 1','Grau 2','Grau 3','Grau 4','Não classificável','Tissular profunda'].map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={15} /></div></label></div>}
          <ChoiceFieldset legend="Cuidados realizados" options={['Limpeza','Cobertura','Desbridamento']} value={form.curativos} onChange={value => onToggle('curativos', value)} multiple />
          <label className="input-field full-field"><span>Outras lesões, quedas ou hematomas</span><textarea rows={2} value={form.lesoes} onChange={event => update('lesoes', event.target.value)} placeholder="Descreva localização e aspecto observado…" /></label>
        </div>}
        {step === 4 && <div className="form-section">
          <div className="step-section-heading"><span className="step-section-icon"><Star size={22} /></span><div><strong>Satisfação do contratante</strong><span>{steps[4]!.description}</span></div></div>
          <div className="clinical-ratings">{([['satisfacaoMonitoramentoComunicacao','Monitoramento & Comunicação'],['satisfacaoSuporteEnfermagem','Suporte da Enfermagem'],['satisfacaoCuidadoresDia','Equipe de Cuidadores (Dia)'],['satisfacaoCuidadoresNoite','Equipe de Cuidadores (Noite)']] as const).map(([key,label]) => <fieldset className="clinical-rating" key={key}><legend>{label}</legend><div className="clinical-rating-stars" role="radiogroup" aria-label={label}>{[1,2,3,4,5].map(value => <button type="button" key={value} role="radio" aria-checked={form[key] === value} aria-label={`${value} de 5 estrelas`} onClick={() => update(key, form[key] === value ? 0 : value)}><Star size={19} fill={form[key] >= value ? 'currentColor' : 'none'} /></button>)}</div></fieldset>)}</div>
          <label className="input-field full-field"><span>Comentário do contratante</span><textarea rows={2} value={form.satisfacao} onChange={event => update('satisfacao', event.target.value)} placeholder="Observações, elogios ou reclamações…" /></label>
        </div>}
      </div>
      <div className="form-footer evolution-footer"><span className="evolution-save-context">O registro será associado a {patientName}.</span><div className="evolution-actions">
        {step > 0 && <button type="button" className="secondary" onClick={() => setStep(current => current - 1)}><ChevronLeft size={17} />Voltar</button>}
        {step < steps.length - 1 ? <button type="button" className="primary" onClick={() => setStep(current => Math.min(current + 1, steps.length - 1))}>Próximo<ChevronRight size={17} /></button> : <button type="submit" className="primary" disabled={saving || draftState === 'loading' || draftState === 'saving'}>{saving ? 'Salvando…' : 'Salvar evolução'}<HeartPulse size={17} /></button>}
      </div></div>
      </form>}
      {latestOpen && latestEvolution && <div className="modal-backdrop history-peek-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setLatestOpen(false) }}><section className="history-peek-drawer" role="dialog" aria-modal="true" aria-labelledby="latest-evolution-title"><div className="modal-header"><div><span className="eyebrow">CONSULTA RÁPIDA · #{latestEvolution.EvolucaoId}</span><h2 id="latest-evolution-title">Última evolução</h2><p><Clock3 size={14} /> {new Date(latestEvolution.DataHora).toLocaleString('pt-BR')} · {latestEvolution.Enfermeira || 'Equipe clínica'}</p></div><button className="icon-button" onClick={() => setLatestOpen(false)} aria-label="Fechar consulta rápida"><X size={18} /></button></div><div className="history-peek-content"><h3>Sinais vitais</h3><div className="history-peek-vitals">{[['PA', latestEvolution.PressaoArterial], ['SpO₂', latestEvolution.Spo2 && `${latestEvolution.Spo2}%`], ['FC', latestEvolution.FrequenciaCardiaca], ['Temperatura', latestEvolution.Temperatura], ['FR', latestEvolution.FrequenciaRespiratoria], ['HGT', latestEvolution.Hgt]].filter(([, value]) => Boolean(value)).map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{value}</strong></div>)}</div><h3>Avaliação e conduta</h3><div className="history-peek-facts">{latestEvolution.Consciencia && <p><strong>Consciência</strong><span>{latestEvolution.Consciencia}</span></p>}{latestEvolution.CondicaoGeral && <p><strong>Condição geral</strong><span>{latestEvolution.CondicaoGeral}</span></p>}{parseList(latestEvolution.Pele).length > 0 && <p><strong>Aspecto da pele</strong><span>{parseList(latestEvolution.Pele).join(', ')}</span></p>}{latestEvolution.PossuiLpp === 'Sim' && <p><strong>LPP</strong><span>{[latestEvolution.LocalizacaoLpp, latestEvolution.GrauLpp].filter(Boolean).join(' · ') || 'Registrada'}</span></p>}{parseList(latestEvolution.Curativos).length > 0 && <p><strong>Cuidados realizados</strong><span>{parseList(latestEvolution.Curativos).join(', ')}</span></p>}{latestEvolution.Lesoes && <p><strong>Lesões</strong><span>{latestEvolution.Lesoes}</span></p>}{latestEvolution.Observacoes && <p><strong>Observações</strong><span>{latestEvolution.Observacoes}</span></p>}</div>{!latestEvolution.PressaoArterial && !latestEvolution.Spo2 && !latestEvolution.FrequenciaCardiaca && !latestEvolution.Temperatura && !latestEvolution.FrequenciaRespiratoria && !latestEvolution.Hgt && !latestEvolution.Consciencia && !latestEvolution.CondicaoGeral && !latestEvolution.Pele && !latestEvolution.Observacoes && <p className="history-peek-empty">Este registro não contém medidas ou observações para consulta rápida.</p>}</div><div className="modal-footer"><span>O preenchimento atual foi preservado.</span><button className="primary" onClick={() => setLatestOpen(false)}>Voltar ao registro</button></div></section></div>}
  </section>
}
