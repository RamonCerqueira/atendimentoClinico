'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

type Visit = { VisitaId: number; DataHora: string; Status: string; NomePaciente?: string; Enfermeira?: string }

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const statusClass: Record<string, string> = {
  PENDENTE: 'pending',
  CONFIRMADA: 'confirmed',
  EM_ATENDIMENTO: 'in-progress',
  CANCELADA: 'cancelled',
  REALIZADA: 'completed',
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function VisitCalendar({ month, selectedDate, visits, filterValue, filterOptions, onFilterChange, loading, loadError, onRetry, onSelectDate, onChangeMonth, onMoveVisit, onAddVisit }: {
  month: Date
  selectedDate: string
  visits: Visit[]
  filterValue: string
  filterOptions: string[]
  onFilterChange: (value: string) => void
  loading: boolean
  loadError: string
  onRetry: () => void
  onSelectDate: (date: string) => void
  onChangeMonth: (delta: number) => void
  onMoveVisit: (visitId: number, date: string) => void
  onAddVisit: (date: string) => void
}) {
  const [draggingVisit, setDraggingVisit] = useState<number | null>(null)
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = firstDay.getDay()
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - offset)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7
  const cells = Array.from({ length: cellCount }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index))
  const visitsByDate = new Map<string, Visit[]>()
  for (const visit of visits) {
    const key = dateKey(new Date(visit.DataHora))
    visitsByDate.set(key, [...(visitsByDate.get(key) || []), visit])
  }
  const today = dateKey(new Date())

  return <section className="panel calendar-panel" aria-label="Calendário de visitas">
    <div className="calendar-heading">
      <div><span className="eyebrow">VISÃO MENSAL</span><h2>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month)}</h2></div>
      <div className="calendar-heading-tools">
        {!loading && !loadError && filterOptions.length > 1 && <label className="calendar-neighborhood-filter"><MapPin size={16} aria-hidden="true" /><span>Bairro</span><select value={filterValue} onChange={event => onFilterChange(event.target.value)} aria-label="Filtrar visitas do calendário por bairro"><option value="">Todos os bairros</option>{filterOptions.map(name => <option value={name} key={name}>{name}</option>)}</select></label>}
        <div className="calendar-navigation"><button className="icon-button" onClick={() => onChangeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button><button className="secondary today-button" onClick={() => onSelectDate(today)}>Hoje</button><button className="icon-button" onClick={() => onChangeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button></div>
      </div>
    </div>
    {loading && <div className="calendar-fetch-state" role="status"><span className="spinner" />Atualizando visitas da agenda…</div>}
    {loadError && <div className="calendar-fetch-state calendar-fetch-error" role="alert"><span>{loadError}</span><button className="secondary small" onClick={onRetry}>Tentar novamente</button></div>}
    <div className="calendar-grid" aria-label="Dias do mês e visitas agendadas">
      {weekdays.map((day, index) => <div className="calendar-weekday" key={`${day}-${index}`}>{day}</div>)}
      {cells.map(date => {
        const key = dateKey(date)
        const dayVisits = visitsByDate.get(key) || []
        const inMonth = date.getMonth() === month.getMonth()
        const isPastDay = key < today
        return <div aria-label={`${date.toLocaleDateString('pt-BR')}, ${dayVisits.length} visitas${isPastDay ? ', data anterior a hoje' : ''}`} onDragOver={event => { if (draggingVisit && !isPastDay) event.preventDefault() }} onDrop={event => { event.preventDefault(); const visitId = Number(event.dataTransfer.getData('text/plain')) || draggingVisit; if (visitId && !isPastDay) onMoveVisit(visitId, key); setDraggingVisit(null) }} key={key} className={`calendar-day ${inMonth ? '' : 'outside-month'} ${key === selectedDate ? 'selected' : ''} ${key === today ? 'is-today' : ''} ${isPastDay ? 'past-day' : ''} ${draggingVisit && !isPastDay ? 'drop-enabled' : ''}`}>
          <button type="button" className="calendar-day-select" aria-pressed={key === selectedDate} onClick={() => onSelectDate(key)}>{date.getDate()}</button>
          {dayVisits.length > 0 && <div className="calendar-visit-list">{dayVisits.slice(0, 3).map(visit => {
            const movable = ['PENDENTE', 'CONFIRMADA'].includes(visit.Status) && new Date(visit.DataHora).getTime() > Date.now()
            return <button type="button" draggable={movable} onDragStart={event => { setDraggingVisit(visit.VisitaId); event.dataTransfer.setData('text/plain', String(visit.VisitaId)); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDraggingVisit(null)} onClick={() => onSelectDate(key)} key={visit.VisitaId} className={`calendar-visit-chip ${statusClass[visit.Status] || ''} ${movable ? 'movable' : ''}`} title={movable ? 'Arraste para outro dia para remarcar' : 'Visita sem remarcação'}><span>{new Date(visit.DataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><span>{visit.NomePaciente || `Idoso #${visit.VisitaId}`}</span></button>
          })}{dayVisits.length > 3 && <button type="button" className="calendar-more" onClick={() => onSelectDate(key)}>+{dayVisits.length - 3} visitas</button>}</div>}
          {!dayVisits.length && !isPastDay && <button type="button" className="calendar-add-day" onClick={() => onAddVisit(key)} aria-label={`Agendar visita em ${date.toLocaleDateString('pt-BR')}`} title="Agendar uma visita neste dia">+</button>}
        </div>
      })}
    </div>
    <div className="calendar-legend"><span><i className="calendar-dot pending" />Pendente</span><span><i className="calendar-dot confirmed" />Confirmada</span><span><i className="calendar-dot in-progress" />Em atendimento</span><span><i className="calendar-dot completed" />Realizada</span><span><i className="calendar-dot cancelled" />Cancelada</span><span className="calendar-help">Arraste uma visita pendente ou confirmada para outro dia para remarcar.</span></div>
  </section>
}
