import { Check, Copy, Crown, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FormEvent } from 'react'
import type { Space, SpaceColor, SpaceIcon, SpaceMember, SpaceRole } from '../types'
import { defaultSpaceColor, spaceColors, spaceIcons } from '../lib/spaceAppearance'
import { Avatar } from './Common'
import { SpaceGlyph, spaceAccentStyle, spaceAppearance } from './SpaceVisual'

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function WorkspaceSettingsDialog({ open, onClose, space, currentMember, canEdit, syncEnabled, onUpdate, onInvite, onChangeRole, onRemoveMember }: {
  open: boolean
  onClose: () => void
  space: Space
  currentMember: SpaceMember
  canEdit: boolean
  syncEnabled: boolean
  onUpdate: (updates: { name: string; color: SpaceColor; icon: SpaceIcon }) => void
  onInvite: (invitee: { name: string; email: string; role: SpaceRole }) => SpaceMember | null
  onChangeRole: (memberId: string, role: SpaceRole) => void
  onRemoveMember: (memberId: string) => void
}) {
  const headingId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(space.name)
  const [color, setColor] = useState<SpaceColor>(space.color ?? defaultSpaceColor(space.kind))
  const [icon, setIcon] = useState<SpaceIcon>(spaceAppearance(space).icon)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<SpaceRole>('editor')
  const [copied, setCopied] = useState(false)
  const [memberNotice, setMemberNotice] = useState('')
  const isOwner = currentMember.role === 'owner'
  const canConfigure = canEdit && isOwner
  const memberManagementAvailable = space.kind === 'shared' && canConfigure

  useEffect(() => {
    if (!open) return
    const visual = spaceAppearance(space)
    setName(space.name)
    setColor(space.color ?? defaultSpaceColor(space.kind))
    setIcon(visual.icon)
    setInviteName('')
    setInviteEmail('')
    setInviteRole('editor')
    setCopied(false)
    setMemberNotice('')
  }, [open, space.id, space.name, space.color, space.icon])

  useEffect(() => {
    if (!open) return
    const focusedBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus({ preventScroll: true }), 0)
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])
      if (!controls.length) return
      const first = controls[0]
      const last = controls.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keyboard)
      if (focusedBeforeOpen?.isConnected) focusedBeforeOpen.focus({ preventScroll: true })
    }
  }, [open, onClose])

  if (!open) return null

  const visualPreview = { ...space, color, icon }
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!canConfigure || !name.trim()) return
    onUpdate({ name: name.trim(), color, icon })
    onClose()
  }
  const invite = () => {
    if (!memberManagementAvailable || !inviteName.trim() || !inviteEmail.trim()) {
      setMemberNotice('Enter a name and a valid, unique Google email address.')
      return
    }
    const member = onInvite({ name: inviteName, email: inviteEmail, role: inviteRole })
    if (!member) {
      setMemberNotice('That name or Google email is already in this workspace.')
      return
    }
    setInviteName('')
    setInviteEmail('')
    setInviteRole('editor')
    setMemberNotice(`${member.name} was added as ${member.role}.`)
  }
  const copyInviteLink = async () => {
    const url = `${window.location.origin}/?space=${encodeURIComponent(space.id)}&join=${encodeURIComponent(space.joinCode)}`
    try {
      await navigator.clipboard?.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return createPortal(<div className="workspace-settings-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="workspace-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <header className="workspace-settings-header">
        <div className="workspace-settings-heading"><span className="workspace-settings-preview" style={spaceAccentStyle(visualPreview)}><SpaceGlyph space={visualPreview} size="1.125rem" /></span><div><span className="eyebrow">Workspace settings</span><h2 id={headingId}>Configure {space.name}</h2><p id={descriptionId}>{space.kind === 'shared' ? 'Shape your team’s home and keep its member list current.' : 'Make this private planning space feel like your own.'}</p></div></div>
        <button type="button" className="workspace-settings-close" aria-label="Close workspace settings" onClick={onClose}><X size="1rem" aria-hidden="true" /></button>
      </header>

      <form className="workspace-settings-content" onSubmit={save}>
        <section className="workspace-settings-section" aria-labelledby={`${headingId}-identity`}>
          <div className="workspace-settings-section-title"><span className="eyebrow" id={`${headingId}-identity`}>Identity</span><p>{canConfigure ? 'Choose a title, color, and icon for this workspace.' : 'Only a Workspace Owner can change its identity and membership.'}</p></div>
          <label className="workspace-title-field">Workspace title<input ref={titleInputRef} value={name} maxLength={80} required disabled={!canConfigure} onChange={(event) => setName(event.target.value)} /></label>
          <fieldset className="workspace-choice-field"><legend>Workspace color</legend><div className="workspace-color-options">{(Object.entries(spaceColors) as [SpaceColor, typeof spaceColors[SpaceColor]][]).map(([candidate, detail]) => <button key={candidate} type="button" className={color === candidate ? 'is-selected' : ''} aria-pressed={color === candidate} aria-label={`${detail.label} workspace color`} disabled={!canConfigure} onClick={() => setColor(candidate)}><i style={{ background: detail.accent }} /><span>{detail.label}</span>{color === candidate && <Check size=".75rem" aria-hidden="true" />}</button>)}</div></fieldset>
          <fieldset className="workspace-choice-field"><legend>Workspace icon</legend><div className="workspace-icon-options">{spaceIcons.map((candidate) => <button key={candidate.id} type="button" className={icon === candidate.id ? 'is-selected' : ''} aria-label={`${candidate.label} workspace icon`} aria-pressed={icon === candidate.id} disabled={!canConfigure} onClick={() => setIcon(candidate.id)}><SpaceGlyph space={{ kind: space.kind, color, icon: candidate.id }} size="1rem" /><span>{candidate.label}</span></button>)}</div></fieldset>
        </section>

        {space.kind === 'shared' && <section className="workspace-settings-section workspace-members-section" aria-labelledby={`${headingId}-members`}>
          <div className="workspace-settings-section-title"><span className="eyebrow" id={`${headingId}-members`}>Members</span><p>{syncEnabled ? 'Invite colleagues by the Google email they use for this Space.' : 'Changes stay on this device until you continue with Google.'}</p></div>
          {memberManagementAvailable && <><div className="workspace-invite-link"><span><strong>Invite link</strong><small>Add the colleague’s Google email first, then share this link.</small></span><button type="button" className="button button-quiet" onClick={() => void copyInviteLink()}>{copied ? <Check size=".8125rem" /> : <Copy size=".8125rem" />}{copied ? 'Copied' : 'Copy link'}</button></div><div className="workspace-member-invite">
            <label>Name<input maxLength={80} value={inviteName} placeholder="Colleague name" onChange={(event) => setInviteName(event.target.value)} /></label>
            <label>Email<input type="email" maxLength={254} value={inviteEmail} placeholder="name@school.edu" onChange={(event) => setInviteEmail(event.target.value)} /></label>
            <label>Access<select aria-label="New member role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as SpaceRole)}><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label>
            <button type="button" className="button button-accent" disabled={!inviteName.trim() || !inviteEmail.trim()} onClick={invite}><UserPlus size=".8125rem" />Add member</button>
          </div>{memberNotice && <p className="workspace-member-notice" role="status">{memberNotice}</p>}</>}
          {!memberManagementAvailable && <p className="workspace-member-readonly">You have view-only access to this Space. Ask an Owner to manage members.</p>}
          <ul className="workspace-member-list" aria-label="Workspace members">{space.members.map((member) => {
            const owner = member.id === space.ownerId
            const canManageThisMember = isOwner && !owner
            return <li key={member.id}><span className={`workspace-member-avatar presence-${member.presence}`}><Avatar name={member.name} /><i aria-hidden="true" /></span><span className="workspace-member-copy"><strong>{member.name}{member.id === currentMember.id && <em>you</em>}</strong><small>{member.email ?? 'No Google email added'} · {member.presence}</small></span>{owner ? <span className="workspace-member-owner"><Crown size=".75rem" />Owner</span> : <><select aria-label={`Role for ${member.name}`} value={member.role} disabled={!canManageThisMember} onChange={(event) => onChangeRole(member.id, event.target.value as SpaceRole)}><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="owner" disabled>Owner</option></select><button type="button" className="workspace-member-remove" aria-label={`Remove ${member.name}`} title={`Remove ${member.name}`} disabled={!canManageThisMember} onClick={() => onRemoveMember(member.id)}><Trash2 size=".8125rem" /></button></>}</li>
          })}</ul>
        </section>}

        <footer className="workspace-settings-actions"><p>{space.kind === 'shared' && <><UsersRound size=".8125rem" aria-hidden="true" />{syncEnabled ? 'Google sync is enabled for this session.' : 'Google sync is off for this session.'}</>}</p><div><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-accent" disabled={!canConfigure || !name.trim()}>Save workspace</button></div></footer>
      </form>
    </section>
  </div>, document.body)
}
