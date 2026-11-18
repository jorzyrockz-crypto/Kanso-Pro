import { ArrowRight, Bell, BellOff, CheckCheck, Clock3, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NotificationsController } from '../lib/useNotifications'
import { PageHeader } from './PageHeader'

export function NotificationsPage({ notifications: n }: { notifications: NotificationsController }) {
  const { preferences: p, items } = n.state
  const [quietError, setQuietError] = useState('')
  const time = (key: 'quietStart' | 'quietEnd', value: string) => {
    if (!value) return
    if (value === (key === 'quietStart' ? p.quietEnd : p.quietStart)) { setQuietError('Choose different start and end times.'); return }
    setQuietError(''); void n.preferences({ [key]: value })
  }
  return <main id="main-content" tabIndex={-1} className="workspace-page notifications-page" aria-labelledby="page-title">
    <PageHeader title="Notifications" description="A quiet nudge for the plans that matter. On this device." action={<button className="button settings-secondary" type="button" disabled={!n.unread} onClick={() => void n.markRead()}><CheckCheck size="1rem" />Mark all read</button>} />
    <div className="notification-layout">
      <section className="notification-inbox" aria-labelledby="notification-inbox-title">
        <div className="notification-section-heading"><Bell size="1.125rem" /><h2 id="notification-inbox-title">Your updates</h2><span>{n.unread} unread</span></div>
        {items.length ? <ol className="notification-list">{items.map(item => <li className={`notification-item ${item.read ? '' : 'is-unread'}`} key={item.id}>
          <Link to={item.href} onClick={() => void n.markRead(item.id)}><span className={`notification-type notification-${item.kind}`} aria-hidden="true"><Bell size="1rem" /></span><span><strong>{item.title}</strong><small>{item.detail}</small><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>{!item.read && <span className="sr-only">Unread</span>}</span><ArrowRight size=".9375rem" aria-hidden="true" /></Link>
          {!item.read && <button type="button" className="text-button" aria-label={`Mark read: ${item.title}`} onClick={() => void n.markRead(item.id)}>Mark read</button>}
        </li>)}</ol> : <div className="notification-empty"><BellOff size="2rem" /><h3>A little breathing room.</h3><p>No notifications yet. Existing deadlines are quietly recorded on first use, without a flood of old reminders.</p></div>}
        <p className="notification-caption">The newest 60 notifications stay in this browser profile. Opening one marks it read and takes you to its plan.</p>
      </section>
      <section className="notification-preferences" aria-labelledby="notification-preferences-title">
        <div className="notification-section-heading"><Settings2 size="1.125rem" /><h2 id="notification-preferences-title">Notification settings</h2></div>
        <p>These settings belong to this local workspace, not an account. Anyone using this browser profile can see its reminders, even while signed out.</p>
        <label className="notification-toggle"><span><strong>Browser notifications</strong><small>Requested when Kanso opens on supported browsers. They can alert you while the app runs in the background; card titles stay off the lock screen.</small></span><input type="checkbox" checked={p.phone} onChange={event => void n.phone(event.target.checked)} /></label>
        <p className="notification-caption">{n.phoneSupported ? `Browser permission: ${n.permission}. On iPhone/iPad, install to the Home Screen first.` : 'Browser notifications need a supported, secure production app. The bell works here without permission.'}</p>
        {n.feedback && <p className="account-feedback" role="status">{n.feedback}</p>}
        <label className="notification-toggle"><span><strong>App icon badge</strong><small>Show the unread count when the installed app and device support badges.</small></span><input type="checkbox" checked={p.badges} onChange={event => void n.preferences({ badges: event.target.checked })} /></label>
        <fieldset className="notification-quiet"><legend><Clock3 size="1rem" />Quiet hours</legend><label className="notification-toggle"><span><strong>Pause browser notifications</strong><small>The bell still collects reminders. Background reminders are grouped when quiet hours end and the app can run.</small></span><input type="checkbox" checked={p.quiet} onChange={event => void n.preferences({ quiet: event.target.checked })} /></label><div className="notification-times"><label>From<input type="time" value={p.quietStart} disabled={!p.quiet} onChange={event => time('quietStart', event.target.value)} /></label><label>Until<input type="time" value={p.quietEnd} disabled={!p.quiet} onChange={event => time('quietEnd', event.target.value)} /></label></div><small>Uses your device’s local time.</small>{quietError && <p role="status">{quietError}</p>}</fieldset>
        <fieldset className="notification-categories"><legend>Planner reminders</legend>
          <label className="notification-toggle"><span><strong>Events</strong><small>At the event’s start time; all-day events at 8 am.</small></span><input type="checkbox" checked={p.events} onChange={event => void n.preferences({ events: event.target.checked })} /></label>
          <label className="notification-toggle"><span><strong>Tasks</strong><small>At the reminder time, or 9 am if none is set. Completed lists are skipped.</small></span><input type="checkbox" checked={p.tasks} onChange={event => void n.preferences({ tasks: event.target.checked })} /></label>
          <label className="notification-toggle"><span><strong>Project due dates</strong><small>At 9 am on the due date, unless all milestones are complete.</small></span><input type="checkbox" checked={p.projects} onChange={event => void n.preferences({ projects: event.target.checked })} /></label>
        </fieldset>
        <p className="notification-limit">No push server is configured. Checks run about once a minute while the page can run, and on return. Fully closed or suspended apps cannot deliver reliable alarms; missed reminders appear next time you open Kanso Pro.</p>
        {!n.storageAvailable && <p className="account-feedback is-error" role="status">Notification storage is unavailable. This inbox and its preferences last only for this session. Your planner storage is separate.</p>}
      </section>
    </div>
  </main>
}
