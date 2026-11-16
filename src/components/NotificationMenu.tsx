import { ArrowRight, Bell, BellOff, CheckCheck, Clock3, Settings2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { NotificationsController } from '../lib/useNotifications'

/** A compact, Facebook-style inbox disclosure for the header bell. */
export function NotificationMenu({ notifications: n, open, onOpenChange }: {
  notifications: NotificationsController
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const [quietError, setQuietError] = useState('')
  const { preferences: p, items } = n.state

  const close = (returnFocus = false) => {
    onOpenChange(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }
  const time = (key: 'quietStart' | 'quietEnd', value: string) => {
    if (!value) return
    if (value === (key === 'quietStart' ? p.quietEnd : p.quietStart)) { setQuietError('Choose different start and end times.'); return }
    setQuietError('')
    void n.preferences({ [key]: value })
  }

  useEffect(() => {
    if (!open) return
    const isInside = (target: EventTarget | null) => target instanceof Node && (rootRef.current?.contains(target) || panelRef.current?.contains(target))
    const outside = (event: PointerEvent) => {
      if (!isInside(event.target)) close(false)
    }
    const focusOutside = (event: FocusEvent) => {
      if (!isInside(event.target)) close(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focusOutside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', focusOutside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onOpenChange])

  return <div className="notification-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="notification-bell header-action" aria-label={n.unread ? `Notifications, ${n.unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} title="Notifications" onClick={() => onOpenChange(!open)}>
      <Bell size="1.125rem" aria-hidden="true" />{n.unread > 0 && <span className="notification-count" aria-hidden="true">{n.unread > 9 ? '9+' : n.unread}</span>}
    </button>
    {open && createPortal(<><div className="notification-menu-scrim" aria-hidden="true" /><section ref={panelRef} id={panelId} className="notification-menu-panel" role="dialog" aria-label="Notifications">
      <header className="notification-menu-heading">
        <div><strong>Notifications</strong><span>{n.unread ? `${n.unread} unread` : 'All caught up'}</span></div>
        <div>{n.unread > 0 && <button type="button" className="notification-mark-all" onClick={() => void n.markRead()}><CheckCheck size=".875rem" aria-hidden="true" />Mark all read</button>}<button type="button" className="notification-menu-close" aria-label="Close notifications" onClick={() => close(true)}><X size="1rem" /></button></div>
      </header>
      <div className="notification-menu-body">
        <label className="notification-menu-switch notification-phone-switch">
          <span><strong>{p.phone ? 'Phone notifications are on' : 'Phone notifications are off'}</strong><small>{p.phone ? 'Kanso can alert you while it is running. Card titles stay off the lock screen.' : 'Turn them on to request permission when your device supports it.'}</small></span>
          <input type="checkbox" checked={p.phone} aria-label="Phone notifications" onChange={(event) => void n.phone(event.target.checked)} />
        </label>
        {n.feedback && <p className="notification-menu-feedback" role="status">{n.feedback}</p>}
        <section className="notification-menu-quiet" aria-labelledby={`${panelId}-quiet`}>
          <div className="notification-menu-section-heading"><Clock3 size=".9375rem" aria-hidden="true" /><div><strong id={`${panelId}-quiet`}>Quiet hours</strong><span>{p.quiet ? `Phone alerts pause from ${p.quietStart} to ${p.quietEnd}.` : 'Keep phone alerts flowing at every hour.'}</span></div><label className="notification-mini-switch"><span className="sr-only">Pause phone notifications during quiet hours</span><input type="checkbox" checked={p.quiet} onChange={(event) => void n.preferences({ quiet: event.target.checked })} /></label></div>
          {p.quiet && <div className="notification-menu-times"><label>From<input type="time" value={p.quietStart} onChange={(event) => time('quietStart', event.target.value)} /></label><label>Until<input type="time" value={p.quietEnd} onChange={(event) => time('quietEnd', event.target.value)} /></label></div>}
          {quietError && <p className="notification-menu-feedback" role="status">{quietError}</p>}
        </section>
        <section className="notification-menu-inbox" aria-labelledby={`${panelId}-updates`}>
          <div className="notification-menu-subheading"><strong id={`${panelId}-updates`}>Recent updates</strong><span>{items.length ? `${items.length} saved` : 'No alerts yet'}</span></div>
          {items.length ? <ol className="notification-menu-list">{items.slice(0, 8).map((item) => <li key={item.id} className={item.read ? '' : 'is-unread'}><Link to={item.href} onClick={() => { void n.markRead(item.id); close(false) }}><span className={`notification-type notification-${item.kind}`}><Bell size=".875rem" aria-hidden="true" /></span><span><strong>{item.title}</strong><small>{item.detail}</small><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></span><ArrowRight size=".8125rem" aria-hidden="true" /></Link></li>)}</ol> : <div className="notification-menu-empty"><BellOff size="1.75rem" aria-hidden="true" /><strong>A little breathing room.</strong><p>New event, task, and project reminders will appear here.</p></div>}
        </section>
        <details className="notification-menu-options"><summary><Settings2 size=".875rem" aria-hidden="true" />Reminder categories</summary><div>
          <label className="notification-menu-option"><span><strong>Events</strong><small>At their scheduled start.</small></span><input type="checkbox" checked={p.events} onChange={(event) => void n.preferences({ events: event.target.checked })} /></label>
          <label className="notification-menu-option"><span><strong>Tasks</strong><small>At the reminder time, or 9 am.</small></span><input type="checkbox" checked={p.tasks} onChange={(event) => void n.preferences({ tasks: event.target.checked })} /></label>
          <label className="notification-menu-option"><span><strong>Project due dates</strong><small>At 9 am on their due date.</small></span><input type="checkbox" checked={p.projects} onChange={(event) => void n.preferences({ projects: event.target.checked })} /></label>
        </div></details>
      </div>
      <footer className="notification-menu-footer"><Link to="/notifications" onClick={() => close(false)}>Open notification settings <ArrowRight size=".75rem" aria-hidden="true" /></Link></footer>
    </section></>, document.body)}
  </div>
}
