'use client'

import { ClipboardCheck, Save } from 'lucide-react'

export type CarePlan = {
  PlanoId?: number
  Objetivos?: string | null
  Cuidados?: string | null
  Riscos?: string | null
  Contatos?: string | null
  RevisarEm?: string | null
  CriadoEm?: string | null
  Enfermeira?: string | null
}
export type CarePlanDraft = { Objetivos: string; Cuidados: string; Riscos: string; Contatos: string; RevisarEm: string }

export default function CarePlanWorkspace({ plan, versions, draft, setDraft, saving, onSave }: {
  plan: CarePlan | null
  versions: CarePlan[]
  draft: CarePlanDraft
  setDraft: (draft: CarePlanDraft) => void
  saving: boolean
  onSave: (event: React.FormEvent) => void
}) {
  return <section className="panel care-plan-panel">
    <div className="panel-heading"><div><h2><ClipboardCheck size={18} /> Plano de cuidado</h2><p>Orientações atuais para manter o cuidado consistente entre as visitas.</p></div>{plan?.CriadoEm && <span className="history-count">Atualizado {new Date(plan.CriadoEm).toLocaleDateString('pt-BR')}</span>}</div>
    <form className="care-plan-form" onSubmit={onSave}>
      <div className="care-plan-grid">
        <label className="input-field"><span>Objetivos do cuidado</span><textarea rows={3} maxLength={8000} value={draft.Objetivos} onChange={event => setDraft({ ...draft, Objetivos: event.target.value })} placeholder="Ex.: manter conforto, mobilidade e hidratação…" /></label>
        <label className="input-field"><span>Cuidados e orientações</span><textarea rows={3} maxLength={12000} value={draft.Cuidados} onChange={event => setDraft({ ...draft, Cuidados: event.target.value })} placeholder="Rotina, precauções e instruções para a equipe…" /></label>
        <label className="input-field"><span>Riscos e sinais de alerta</span><textarea rows={3} maxLength={8000} value={draft.Riscos} onChange={event => setDraft({ ...draft, Riscos: event.target.value })} placeholder="O que observar e quando comunicar a equipe…" /></label>
        <label className="input-field"><span>Contatos e plano de comunicação</span><textarea rows={3} maxLength={4000} value={draft.Contatos} onChange={event => setDraft({ ...draft, Contatos: event.target.value })} placeholder="Responsável, equipe e fluxo de comunicação…" /></label>
      </div>
      <div className="care-plan-footer"><label className="input-field"><span>Revisar plano em</span><input type="date" value={draft.RevisarEm} onChange={event => setDraft({ ...draft, RevisarEm: event.target.value })} /></label><div>{plan?.Enfermeira && <span>Última versão registrada por {plan.Enfermeira}</span>}<button className="primary" disabled={saving}><Save size={16} />{saving ? 'Salvando…' : 'Salvar nova versão'}</button></div></div>
    </form>
      {versions.length > 1 && <details className="care-plan-history"><summary>{versions.length - 1} versão{versions.length === 2 ? '' : 'ões'} anterior{versions.length === 2 ? '' : 'es'} do plano</summary><div>{versions.slice(1).map(version => <article key={version.PlanoId}><strong>{version.CriadoEm ? new Date(version.CriadoEm).toLocaleString('pt-BR') : 'Versão anterior'} · {version.Enfermeira || 'Equipe clínica'}</strong><p>{version.Objetivos || version.Cuidados || 'Plano sem descrição registrada.'}</p></article>)}</div></details>}
  </section>
}
