import { BookOpen, CalendarDays, Check, CircleCheck, Plus, Zap } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { CardType } from '../types'

export function TypeIcon({ type, size = 14 }: { type: CardType; size?: number }) {
  const Icon = { event: CalendarDays, task: CircleCheck, project: Zap, note: BookOpen }[type]
  return <Icon size={`${size / 16}rem`} strokeWidth={2} aria-hidden="true" />
}

export function Avatar({ name = 'Floyran Gumban', className = '' }: { name?: string; className?: string }) {
  if (name === 'Floyran Gumban') return (
    <span className={`avatar avatar-portrait ${className}`} title={name} aria-label={name} role="img">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill="#F4CFC2" />
        <path d="M9 25c-5-19 6-23 12-22 11 0 15 10 10 23l-22-1Z" fill="#463236" />
        <path d="M4 40c1-12 10-13 16-13s15 2 16 13" fill="#426270" />
        <path d="M16 24h8v7c-3 3-6 2-8 0v-7Z" fill="#D89D85" />
        <ellipse cx="20" cy="17" rx="8" ry="11" fill="#ECC0A3" />
        <path d="M11 17C8 5 22 1 28 10c-5 1-9-2-9-2s-2 7-8 9Z" fill="#463236" />
        <path d="M17 21c2 2 4 2 6 0" stroke="#A66C61" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  )
  const initials = name === 'You' ? 'Y' : name.split(/[ .]+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('')
  return <span className={`avatar avatar-initials ${className}`} title={name}>{initials}</span>
}

export function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="avatar-stack" aria-label={`Collaborators: ${names.join(', ')}`}>
      {names.slice(0, 2).map((name) => <Avatar key={name} name={name} />)}
      {names.length > 2 && <span className="avatar avatar-more">+{names.length - 2}</span>}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon ?? <CalendarDays size="1.5rem" />}</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function AddChecklistItem({ onAdd, placeholder = 'Add a task…', label = 'Add task' }: {
  onAdd: (title: string) => void
  placeholder?: string
  label?: string
}) {
  const [text, setText] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }
  return (
    <form className="quick-add-form" data-unsaved={!!text.trim()} onSubmit={submit}>
      <label className="sr-only" htmlFor="quick-add-input">{placeholder.replace('…', '')}</label>
      <input id="quick-add-input" value={text} onChange={(event) => setText(event.target.value)} maxLength={240} placeholder={placeholder} required />
      <button className="button button-accent" type="submit"><Plus size="0.9375rem" /><span>{label}</span></button>
    </form>
  )
}

export function SaveIndicator({ available }: { available: boolean }) {
  return <span className={`save-indicator ${available ? '' : 'save-warning'}`}>
    {available ? <Check size="0.75rem" /> : <span className="status-dot" />}
    {available ? 'Saved on this device' : 'Not saved · device storage unavailable'}
  </span>
}
