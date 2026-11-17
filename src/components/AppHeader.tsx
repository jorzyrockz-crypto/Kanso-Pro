import { Check, ChevronDown, CircleDashed, Moon, Plus, Settings2, Sun, WifiOff } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AppearanceController } from '../lib/useAppearance'
import type { AccountController } from '../lib/useAccount'
import type { NotificationsController } from '../lib/useNotifications'
import type { Space, SpaceActivity, SpaceColor, SpaceIcon, SpaceMember, SpaceRole } from '../types'
import { useChromeHeight } from '../lib/useChromeHeight'
import { MoreMenu } from './ProfileMenu'
import { NotificationMenu } from './NotificationMenu'
import { Avatar } from './Common'
import { SpaceGlyph, spaceAccentStyle } from './SpaceVisual'
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog'

export function KansoMark({ size = 24 }: { size?: number }) {
  return <img className="kanso-icon" src="/icons/icon-96.png" width={size} height={size} alt="" aria-hidden="true" decoding="async" />
}

const modeDetails = {
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
  auto: { label: 'Auto', Icon: CircleDashed },
} as const

/** A small, non-modal appearance disclosure that keeps the header's one-row rhythm. */
function HeaderAppearance({ appearance, open, onOpenChange }: { appearance: AppearanceController; open: boolean; onOpenChange: (open: boolean) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const current = modeDetails[appearance.mode]
  const CurrentIcon = current.Icon

  const close = (returnFocus = false) => {
    onOpenChange(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false)
    }
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false)
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

  return <div className="header-disclosure header-appearance" ref={rootRef}>
    <button ref={triggerRef} type="button" className="header-action appearance-trigger" aria-label={`Appearance, ${current.label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} title={`Appearance · ${current.label}`} onClick={() => onOpenChange(!open)}><CurrentIcon size="1.125rem" aria-hidden="true" /></button>
    {open && <section id={panelId} className="header-popover appearance-sheet" role="dialog" aria-label="Appearance">
      <div className="header-popover-heading"><div><strong>Appearance</strong><span>{appearance.scheme === 'dark' ? 'Dark' : 'Light'} now · {current.label}</span></div></div>
      <div className="header-appearance-options" role="radiogroup" aria-label="Color mode">
        {(Object.entries(modeDetails) as [keyof typeof modeDetails, typeof modeDetails[keyof typeof modeDetails]][]).map(([mode, detail]) => {
          const Icon = detail.Icon
          const selected = appearance.mode === mode
          return <button key={mode} type="button" role="radio" aria-checked={selected} className={selected ? 'is-selected' : ''} onClick={() => { appearance.setMode(mode); close(true) }}><Icon size="1rem" aria-hidden="true" /><span>{detail.label}</span></button>
        })}
      </div>
      {!appearance.storageAvailable && <p className="header-appearance-warning" role="status">Not saved · this choice lasts for this session.</p>}
      <Link to="/settings#appearance" onClick={() => close(false)}>More appearance settings</Link>
    </section>}
  </div>
}

function SpaceSwitcher({ space, spaces, syncEnabled, onSelectSpace, onCreateSpace, onConfigure }: { space: Space; spaces: Space[]; syncEnabled: boolean; onSelectSpace: (id: string) => void; onCreateSpace: (name: string) => Space; onConfigure: () => void }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const close = () => { setOpen(false); setCreating(false); setName('') }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) close() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const create = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onCreateSpace(name)
    close()
  }
  return <div className="space-switcher" ref={root}>
    <button type="button" className="space-switcher-trigger" aria-label={`Switch workspace, current space: ${space.name}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="space-switcher-mark" style={spaceAccentStyle(space)}><SpaceGlyph space={space} /></span><span><strong>{space.name}</strong><small>{space.kind === 'shared' ? syncEnabled ? `${space.members.length} members · Google sync` : `${space.members.length} members · local` : 'Private to you'}</small></span><ChevronDown size=".75rem" aria-hidden="true" />
    </button>
    {open && <section className="space-switcher-panel" role="dialog" aria-label="Switch workspace">
      <header><span className="eyebrow">Your spaces</span><strong>Switch workspace</strong></header>
      <div className="space-switcher-list" role="listbox" aria-label="Workspaces">
        {spaces.map((candidate) => <button key={candidate.id} type="button" role="option" aria-selected={candidate.id === space.id} className={candidate.id === space.id ? 'is-selected' : ''} onClick={() => { onSelectSpace(candidate.id); close() }}><span className="space-switcher-mark" style={spaceAccentStyle(candidate)}><SpaceGlyph space={candidate} /></span><span><strong>{candidate.name}</strong><small>{candidate.kind === 'shared' ? `${candidate.members.length} members` : 'Personal space'}</small></span>{candidate.id === space.id && <Check size=".8125rem" aria-hidden="true" />}</button>)}
      </div>
      {!syncEnabled && <p className="space-sync-note">Shared Spaces stay on this device until you continue with Google.</p>}
      <button type="button" className="space-configure-button" onClick={() => { close(); onConfigure() }}><Settings2 size=".8125rem" />Configure this workspace</button>
      {creating ? <form className="space-create-form" onSubmit={create}><label>New shared space<input autoFocus value={name} maxLength={80} placeholder="e.g. Grade 5 Team" onChange={(event) => setName(event.target.value)} /></label><div><button type="button" className="text-button" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="button button-accent">Create locally</button></div></form> : <button type="button" className="space-create-button" onClick={() => setCreating(true)}><Plus size=".875rem" />Create a new space</button>}
    </section>}
  </div>
}

function MemberStack({ members, spaceName, canEdit, onOpenSettings }: { members: SpaceMember[]; spaceName: string; canEdit: boolean; onOpenSettings: () => void }) {
  const visible = members.filter((member) => member.presence !== 'offline').concat(members.filter((member) => member.presence === 'offline')).slice(0, 4)
  const settingsLabel = `${canEdit ? 'Configure' : 'View'} ${spaceName} workspace settings`
  return <button type="button" className="space-member-stack" aria-label={settingsLabel} aria-haspopup="dialog" title={settingsLabel} onClick={onOpenSettings}>
    {visible.map((member) => <span key={member.id} className={`space-member presence-${member.presence}`} title={`${member.name} · ${member.status || member.role} · ${member.presence === 'online' ? 'Active now' : member.presence}`}><Avatar name={member.name} /><i aria-hidden="true" /><span className="space-member-status" role="tooltip"><strong>{member.name}</strong>{member.status || (member.presence === 'online' ? 'Active in this Space' : member.presence === 'away' ? 'Away for now' : 'Offline')}</span></span>)}
    {members.length > visible.length && <span className="space-member-more">+{members.length - visible.length}</span>}
  </button>
}

export function AppHeader({ account, appearance, storageAvailable, onSignOut, notifications, activity, space, spaces, members, currentMember, canEdit, onSelectSpace, onCreateSpace, onUpdateSpace, onInvite, onChangeRole, onRemoveMember, updateReady, online, syncEnabled, artworkVisible = false, titlebar }: { account: AccountController; appearance: AppearanceController; storageAvailable: boolean; onSignOut: () => Promise<void>; notifications: NotificationsController; activity: SpaceActivity[]; space: Space; spaces: Space[]; members: SpaceMember[]; currentMember: SpaceMember; canEdit: boolean; onSelectSpace: (id: string) => void; onCreateSpace: (name: string) => Space; onUpdateSpace: (updates: { name: string; color: SpaceColor; icon: SpaceIcon }) => void; onInvite: (invitee: { name: string; email: string; role: SpaceRole }) => SpaceMember | null; onChangeRole: (memberId: string, role: SpaceRole) => void; onRemoveMember: (memberId: string) => void; updateReady: boolean; online: boolean; syncEnabled: boolean; artworkVisible?: boolean; titlebar?: ReactNode }) {
  const ref = useChromeHeight<HTMLElement>('--topbar-height')
  const [openMenu, setOpenMenu] = useState<'appearance' | 'notifications' | 'more' | null>(null)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const setAppearanceOpen = (open: boolean) => setOpenMenu(open ? 'appearance' : null)
  const setNotificationsOpen = (open: boolean) => setOpenMenu(open ? 'notifications' : null)
  const setMoreOpen = (open: boolean) => setOpenMenu(open ? 'more' : null)

  return <header ref={ref} className={`topbar ${artworkVisible ? 'has-backdrop' : ''}`}>
    {titlebar}
    <div className="topbar-inner">
      <div className="app-brand">
        <Link to="/" className="brand-home" aria-label="Kanso Pro home"><span className="brand-mark"><KansoMark /></span><span className="brand-copy"><span className="brand-name">Kanso <span>Pro</span></span></span></Link>
        <SpaceSwitcher space={space} spaces={spaces} syncEnabled={syncEnabled} onSelectSpace={onSelectSpace} onCreateSpace={onCreateSpace} onConfigure={() => setWorkspaceSettingsOpen(true)} />
        {!online && <span className="offline-badge" title="Your plans are still saved on this device"><WifiOff size="0.75rem" aria-hidden="true" /><span className="sr-only">Offline. </span>Offline</span>}
      </div>
      <div className="topbar-actions">
        <MemberStack members={members} spaceName={space.name} canEdit={canEdit} onOpenSettings={() => setWorkspaceSettingsOpen(true)} />
        <HeaderAppearance appearance={appearance} open={openMenu === 'appearance'} onOpenChange={setAppearanceOpen} />
        <NotificationMenu notifications={notifications} activity={activity} spaceName={space.name} open={openMenu === 'notifications'} onOpenChange={setNotificationsOpen} />
        <MoreMenu open={openMenu === 'more'} onOpenChange={setMoreOpen} updateReady={updateReady} account={account} storageAvailable={storageAvailable} onSignOut={onSignOut} />
      </div>
    </div>
    <WorkspaceSettingsDialog open={workspaceSettingsOpen} onClose={() => setWorkspaceSettingsOpen(false)} space={space} currentMember={currentMember} canEdit={canEdit} syncEnabled={syncEnabled} onUpdate={onUpdateSpace} onInvite={onInvite} onChangeRole={onChangeRole} onRemoveMember={onRemoveMember} />
  </header>
}
