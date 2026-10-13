'use client'

import { Activity, AlertTriangle, BellRing, CalendarDays, Check, ChevronRight, ClipboardList, FileClock, ShieldAlert } from 'lucide-react'

export type ClinicalNotification = {
  id: string
  visitId: number
  patientId: number
  patientName: string
  nurseName: string
  dataHora: string
  date: string
  type: 'confirmation' | 'evolution' | 'upcoming' | 'careplan' | 'incident' | 'draft' | 'scale'
  title: string
  detail: string
}

const iconFor = (type: ClinicalNotification['type']) => {
  if (type === 'incident') return ShieldAlert
  if (type === 'draft' || type === 'evolution') return FileClock
  if (type === 'scale') return AlertTriangle
  if (type === 'careplan') return ClipboardList
  if (type === 'upcoming') return CalendarDays
  return Activity
}

export default function PendingWorkspace({ items, isAdmin, onOpen }: {
  items: ClinicalNotification[]
  isAdmin: boolean
  onOpen: (item: ClinicalNotification) => void
}) {
  const priority = (type: ClinicalNotification['type']) => ({ incident: 0, evolution: 1, draft: 2, scale: 3, confirmation: 4, careplan: 5, upcoming: 6 }[type])
  const ordered = [...items].sort((a, b) => priority(a.type) - priority(b.type) || a.date.localeCompare(b.date))
  return <section className="mx-auto w-full max-w-[1180px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><span className="text-xs font-bold uppercase tracking-[.16em] text-[var(--brand)]">ROTINA DE CUIDADO</span><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">Pendências</h1><p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Acompanhe visitas, registros e revisões que precisam de uma ação.</p></div>
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--ink)]"><BellRing size={16} className="text-[var(--brand)]" />{ordered.length} em aberto</div>
    </header>
    {ordered.length ? <div className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--white)] shadow-sm">
      {ordered.map(item => {
        const Icon = iconFor(item.type)
        return <article key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--paper)]">
          <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.type === 'incident' ? 'bg-rose-100 text-rose-700' : item.type === 'scale' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--brand-pale)] text-[var(--brand)]'}`}><Icon size={19} /></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="font-semibold text-[var(--ink)]">{item.title}</h2><span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{item.type === 'incident' ? 'Intercorrência' : item.type === 'draft' ? 'Rascunho' : item.type === 'scale' ? 'Escala' : item.type === 'careplan' ? 'Plano de cuidado' : item.type === 'evolution' ? 'Evolução' : item.type === 'confirmation' ? 'Confirmação' : 'Visita'}</span></div>
            <p className="mt-1 text-sm text-[var(--ink)]">{item.patientName}{isAdmin ? ` · ${item.nurseName}` : ''}</p><p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
          </div>
          <div className="flex items-center gap-3"><time className="text-xs text-[var(--subtle)]">{new Date(item.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><button type="button" onClick={() => onOpen(item)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">Abrir<ChevronRight size={15} /></button></div>
        </article>
      })}
    </div> : <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--white)] p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Check size={22} /></div><h2 className="mt-4 text-lg font-semibold text-[var(--ink)]">Tudo em dia</h2><p className="mt-1 text-sm text-[var(--muted)]">Não há pendências para acompanhar agora.</p></div></div>}
    {isAdmin && <p className="flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-xs text-[var(--muted)]"><AlertTriangle size={15} className="mt-0.5 shrink-0" />A lista administrativa consolida itens das enfermeiras habilitadas. Os registros clínicos permanecem vinculados ao profissional responsável.</p>}
  </section>
}
