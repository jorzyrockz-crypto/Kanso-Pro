import { ArrowRight, CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { FOCUS_DATE } from '../data'
import type { CardType, ComposerOptions, EventCard, JourneyCard, NewCardInput, TaskCard } from '../types'
import { createCard, TYPE_CONFIG, updateCardFromInput } from '../lib/journey'
import { TypeIcon } from './Common'
import { EventThemePicker } from './EventThemePicker'

export function Composer({ options, cards, editingCard, onCancel, onCreate, onUpdate }: {
  options: ComposerOptions
  cards: JourneyCard[]
  editingCard?: EventCard | TaskCard
  onCancel: () => void
  onCreate: (card: JourneyCard) => void
  onUpdate: (card: EventCard | TaskCard) => void
}) {
  const editing = !!editingCard
  const [input, setInput] = useState<NewCardInput>(() => editingCard ? {
    type: editingCard.type,
    title: editingCard.title,
    date: editingCard.date,
    context: editingCard.context,
    time: editingCard.type === 'event' ? editingCard.time ?? '09:00' : editingCard.reminder ?? '',
    endTime: editingCard.type === 'event' ? editingCard.endTime ?? '' : '',
    allDay: editingCard.type === 'event' ? editingCard.allDay : false,
    dueDate: editingCard.date,
    details: '',
    ...(editingCard.type === 'event' ? { owner: editingCard.owner, organization: editingCard.organization, location: editingCard.location, occasion: editingCard.occasion ?? 'auto' } : {}),
  } : {
    type: options.type ?? 'event', title: '', date: options.date ?? FOCUS_DATE,
    context: '', time: '09:00', endTime: '', allDay: true, dueDate: options.date ?? FOCUS_DATE, details: '', owner: 'You', organization: '', location: '', occasion: 'auto',
  })
  const [error, setError] = useState('')
  const update = <K extends keyof NewCardInput>(key: K, value: NewCardInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }))
    setError('')
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      if (editingCard) onUpdate(updateCardFromInput(editingCard, input))
      else onCreate(createCard(input, cards))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
    }
  }
  return <section className="composer-card" aria-labelledby="composer-title">
    <div className="composer-header"><div><span className="eyebrow"><Plus size="0.6875rem" />{editing ? 'Card details' : 'A new little chapter'}</span><h2 id="composer-title">{editing ? input.type === 'event' ? 'Event details' : 'Task card details' : 'Add to your journey'}</h2></div></div>
    <form className={`composer-form composer-${input.type}`} onSubmit={submit}>
      {editing ? <p className="composer-edit-kind"><TypeIcon type={input.type} size={15} />{input.type === 'event' ? 'Calendar event' : 'Personal task card'} · Your existing checklist stays exactly as it is.</p> : <fieldset className="type-fieldset"><legend>What are we making room for?</legend><div className="type-options">{(['event', 'task', 'project', 'note'] as CardType[]).map((type) => <label className={`type-option option-${type}`} key={type}>
        <input type="radio" name="cardType" value={type} checked={input.type === type} onChange={() => update('type', type)} />
        <span><TypeIcon type={type} size={18} /><span>{type === 'note' ? 'Note' : TYPE_CONFIG[type].label.split(' ')[0]}</span></span>
      </label>)}</div></fieldset>}
      <div className="form-field"><label htmlFor="card-title">Card title <span>*</span></label><input id="card-title" data-page-focus="true" required maxLength={160} value={input.title}
        onChange={(event) => update('title', event.target.value)} placeholder={{ event: 'e.g. A fresh start with the team', task: 'e.g. Prepare for the week ahead', project: 'e.g. Bring the reading festival to life', note: 'e.g. A thought worth coming back to' }[input.type]} /></div>
      <div className="form-row form-row-date-time">
        <div className="form-field"><label htmlFor="card-date"><CalendarDays size="0.75rem" />Journey date <span>*</span></label><input id="card-date" type="date" required min="1900-01-01" max="2100-12-31" value={input.date} onChange={(event) => {
          const nextDate = event.target.value
          setInput((current) => ({ ...current, date: nextDate, dueDate: current.dueDate < nextDate ? nextDate : current.dueDate }))
          setError('')
        }} /></div>
        {input.type === 'project' ? <div className="form-field"><label htmlFor="card-due">Due date <span>*</span></label><input id="card-due" type="date" required min={input.date} max="2100-12-31" value={input.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></div>
          : input.type !== 'note' && <><div className="form-field"><label htmlFor="card-time">{input.type === 'task' ? 'Reminder time' : 'Start time'}</label><input id="card-time" type="time" disabled={input.type === 'event' && input.allDay} value={input.time} onChange={(event) => update('time', event.target.value)} /></div>{input.type === 'event' && <div className="form-field"><label htmlFor="card-end-time">End time <span className="optional-label">optional</span></label><input id="card-end-time" type="time" disabled={input.allDay} value={input.endTime ?? ''} onChange={(event) => update('endTime', event.target.value)} /></div>}</>}
      </div>
      {input.type === 'event' && <><label className="all-day-toggle"><input type="checkbox" checked={input.allDay} onChange={(event) => update('allDay', event.target.checked)} /><span>Make it an all-day event</span></label><div className="form-row">
        <div className="form-field"><label htmlFor="card-organization">Calendar or organization <span className="optional-label">optional</span></label><input id="card-organization" value={input.organization ?? ''} maxLength={160} onChange={(event) => update('organization', event.target.value)} placeholder="e.g. Personal Calendar" /></div>
        <div className="form-field"><label htmlFor="card-owner">Organizer <span className="optional-label">optional</span></label><input id="card-owner" value={input.owner ?? ''} maxLength={160} onChange={(event) => update('owner', event.target.value)} placeholder="e.g. You" /></div>
      </div><div className="form-field"><label htmlFor="card-location">Location <span className="optional-label">optional</span></label><input id="card-location" value={input.location ?? ''} maxLength={240} onChange={(event) => update('location', event.target.value)} placeholder="Where will it happen?" /></div></>}
      <div className="form-field"><label htmlFor="card-context">{input.type === 'event' ? 'Notes and context' : 'A little context'} <span className="optional-label">optional</span></label><input id="card-context" value={input.context} maxLength={240} onChange={(event) => update('context', event.target.value)} placeholder={input.type === 'event' ? 'Anything useful to remember about this event' : 'A team, a purpose, or a note to yourself'} /></div>
      {input.type === 'event' && <EventThemePicker value={input.occasion ?? 'auto'} title={input.title} onChange={(occasion) => update('occasion', occasion)} preview />}
      {input.type !== 'event' && !editing && <div className="form-field"><label htmlFor="card-details">{input.type === 'note' ? 'Your words' : input.type === 'project' ? 'First milestones' : 'The small steps'} <span className="optional-label">optional</span></label>
        <textarea id="card-details" rows={input.type === 'note' ? 4 : 3} maxLength={input.type === 'note' ? 20000 : 9600} value={input.details} onChange={(event) => update('details', event.target.value)} placeholder={input.type === 'note' ? 'Catch a thought before it drifts away…' : 'One action per line. You can always add more later.'} />
      </div>}
      <p className="composer-hint"><span className={`calendar-dot dot-${input.type}`} />{editing ? 'Changes are saved on this device and reflected everywhere this card appears.' : <>Placed in date order. Connected to {TYPE_CONFIG[input.type].workspace === 'project' ? 'Projects' : TYPE_CONFIG[input.type].workspace === 'tasks' ? 'Personal Tasks' : input.type === 'note' ? 'your Journal' : 'your Calendar'}.</>}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="composer-footer"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button type="submit" className="button button-dark">{editing ? 'Save changes' : 'Add to Timeline'}<ArrowRight size="0.875rem" /></button></div>
    </form>
  </section>
}
