import { ArrowRight, Bold, Camera, ChevronDown, Clock3, Code2, Eraser, FileText, Folder, Heading1, Heading2, Highlighter, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered, Mic, Plus, Quote, Search, Square, Tag, Underline } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ChangeEvent, ClipboardEvent, Dispatch, DragEvent, MouseEvent, ReactNode } from 'react'
import { getJournalAttachment, JournalAttachmentError, saveJournalAttachment } from '../lib/journalAttachments'
import { blobAsDataUrl, journalImageUploadErrorMessage, optimizeJournalImage } from '../lib/journalImages'
import { initialJournalRichText, journalRichTextToPlainText, journalRichTextWordCount, sanitizeJournalRichText } from '../lib/journalRichText'
import { formatDate, makeId, shortDate } from '../lib/journey'
import type { Destination, JournalAttachment, JournalNoteKind, JourneyAction, JourneyCard, NoteCard, Space, SpaceMember } from '../types'
import { SaveIndicator, TeamScopeToggle } from './Common'
import { cardAssignedTo } from '../lib/spaces'
import type { CloudSaveState } from './Common'
import { CardDeleteAction } from './CardDeleteAction'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const categoryOptions = ['Personal', 'School', 'Work', 'Ideas']

function noteLabel(kind: JournalNoteKind) {
  return kind === 'voice' ? 'Voice journal entry' : kind === 'image' ? 'Photo journal entry' : 'Text journal entry'
}

function displayTitle(note: NoteCard) {
  return note.title.trim() || `Untitled ${noteLabel(note.noteKind ?? 'text').toLowerCase()}`
}

function updated(note: NoteCard) {
  return note.updatedAt ? new Date(note.updatedAt) : new Date(`${note.date}T${note.time || '12:00'}`)
}

function allAttachments(note: NoteCard) {
  const attachments = [note.attachment, ...(note.attachments ?? [])].filter((attachment): attachment is JournalAttachment => !!attachment)
  return [...new Map(attachments.map((attachment) => [attachment.id, attachment])).values()]
}

function noteIcon(note: NoteCard) {
  const attachments = allAttachments(note)
  if (attachments.some((attachment) => attachment.kind === 'audio') || note.noteKind === 'voice') return Mic
  if (attachments.some((attachment) => attachment.kind === 'image') || note.noteKind === 'image') return ImagePlus
  return FileText
}

function useAttachmentUrl(attachment?: JournalAttachment) {
  const [url, setUrl] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setUrl(null)
    setUnavailable(false)
    if (!attachment || attachment.kind !== 'audio') return
    getJournalAttachment(attachment.id).then((blob) => {
      if (!active) return
      if (!blob) { setUnavailable(true); return }
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => active && setUnavailable(true))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment?.id])
  return { url, unavailable }
}

function useFirestoreImageUrl(firestoreUserId: string | null, attachment?: JournalAttachment, space?: Pick<Space, 'id' | 'kind'>) {
  const [url, setUrl] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    setUrl(null)
    setUnavailable(false)
    if (!firestoreUserId || !attachment || attachment.kind !== 'image' || attachment.storage !== 'firestore') return
    void import('../lib/firestore').then(({ readJournalImage }) => readJournalImage(firestoreUserId, attachment.id, space)).then((dataUrl) => {
      if (!active) return
      if (!dataUrl) { setUnavailable(true); return }
      setUrl(dataUrl)
    }).catch(() => active && setUnavailable(true))
    return () => { active = false }
  }, [attachment?.id, attachment?.storage, firestoreUserId, space?.id, space?.kind])
  return { url, unavailable }
}

function NoteList({ notes, selectedId, compact = false }: { notes: NoteCard[]; selectedId?: string; compact?: boolean }) {
  const [search, setSearch] = useState('')
  const normalized = search.trim().toLocaleLowerCase()
  const visible = notes.filter((note) => !normalized || [note.title, note.body, note.category, ...note.tags].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized))
    .sort((a, b) => updated(b).getTime() - updated(a).getTime())
  return <>
    <label className="journal-search"><Search size=".875rem" aria-hidden="true" /><span className="sr-only">Search journal entries</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search entries, tags, or categories" /></label>
    <div className={`journal-note-list ${compact ? 'is-compact' : ''}`}>
      {visible.map((note) => {
        const Icon = noteIcon(note)
        return <Link key={note.id} className={`journal-note-summary note-${note.noteKind ?? 'text'} ${note.id === selectedId ? 'is-selected' : ''}`} to={`/journal/${encodeURIComponent(note.id)}`} aria-label={`Open ${noteLabel(note.noteKind ?? 'text')}: ${displayTitle(note)}`}>
          <span className="journal-note-kind"><Icon size="1rem" /></span>
          <span className="journal-note-copy"><strong>{displayTitle(note)}</strong><small>{note.body.trim() || noteLabel(note.noteKind ?? 'text')}</small><em>{note.category || 'Personal'} · {shortDate(note.date)}{note.authoredBy ? ` · ${note.authoredBy}` : ''}</em></span>
          {!compact && <span className="journal-note-tags">{note.tags.slice(0, 2).map((tag) => <i key={tag}>#{tag}</i>)}</span>}<ArrowRight size=".875rem" aria-hidden="true" />
        </Link>
      })}
      {!visible.length && <div className="journal-empty"><FileText size="1.25rem" /><p>No journal entries match that search. Try another word, tag, or category.</p></div>}
    </div>
  </>
}

function JournalHero({ note, entryCount, shared, cloudSaveState }: { note: NoteCard; entryCount: number; shared: boolean; cloudSaveState: CloudSaveState }) {
  const cloudEnabled = cloudSaveState !== 'local-only'
  return <section className="workspace-hero hero-note journal-hero" aria-labelledby="journal-hero-title">
    <div className="hero-copy"><div className="hero-eyebrows"><span className="hero-eyebrow"><FileText size={11} />{shared ? cloudEnabled ? 'Space Notes · Google sync' : 'Space Notes · this device' : 'Journal · private reflections'}</span><span className="hero-date">{formatDate(note.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
      <h2 id="journal-hero-title">{displayTitle(note)}</h2><p>{note.context || (shared ? 'A shared meeting log, decision record, or working note for this Space.' : 'A private place for reflections, voice memos, and visual references.')}</p>
    </div>
    <div className="hero-stat"><span>{entryCount === 1 ? 'Journal entry' : 'Journal entries'}</span><strong>{entryCount}</strong></div>
  </section>
}

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function MetadataFields({ note, dispatch, canEdit }: { note: NoteCard; dispatch: Dispatch<JourneyAction>; canEdit: boolean }) {
  // In the compact Journal layout the writing surface should appear first; supporting fields remain one tap away.
  const [open, setOpen] = useState(false)
  const update = (changes: Omit<Extract<JourneyAction, { type: 'update-note' }>, 'type' | 'id' | 'updatedAt'>) => dispatch({ type: 'update-note', id: note.id, ...changes, updatedAt: new Date().toISOString() })
  return <details className="studio-note-details" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}><summary><span>Entry details</span><small>Tags, category & reminder</small><ChevronDown size=".8125rem" aria-hidden="true" /></summary><div className="journal-metadata-fields">
    <label><Tag size=".75rem" />Tags<input aria-label="Tags, separated by commas" disabled={!canEdit} value={note.tags.join(', ')} placeholder="e.g. personal, ideas" onChange={(event) => update({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12) })} /></label>
    <label><Folder size=".75rem" aria-hidden="true" />Category<select aria-label="Note category" disabled={!canEdit} value={note.category ?? 'Personal'} onChange={(event) => update({ category: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label><Clock3 size=".75rem" />Reminder<input aria-label="Note reminder" type="datetime-local" disabled={!canEdit} value={note.reminderAt ?? ''} onChange={(event) => update({ reminderAt: event.target.value })} /></label>
  </div><div className="journal-card-fields"><label>Entry date<input aria-label="Journal entry date" type="date" disabled={!canEdit} value={note.date} min="1900-01-01" max="2100-12-31" onChange={(event) => update({ date: event.target.value })} /></label><label>Timeline context<input aria-label="Journal timeline context" disabled={!canEdit} value={note.context} maxLength={240} placeholder="A private entry for yourself" onChange={(event) => update({ context: event.target.value })} /></label></div></details>
}

function formatDuration(seconds?: number) {
  if (!seconds) return 'Voice memo'
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

function AttachmentTile({ attachment, firestoreUserId, onEmbed, space }: { attachment: JournalAttachment; firestoreUserId: string | null; onEmbed: (attachment: JournalAttachment) => void; space: Pick<Space, 'id' | 'kind'> }) {
  const audio = useAttachmentUrl(attachment.kind === 'audio' ? attachment : undefined)
  const image = useFirestoreImageUrl(firestoreUserId, attachment.kind === 'image' ? attachment : undefined, space)
  const Icon = attachment.kind === 'audio' ? Mic : ImagePlus
  return <article className={`studio-attachment attachment-${attachment.kind}`}>
    <div className="studio-attachment-heading"><span className="studio-attachment-icon"><Icon size=".8125rem" /></span><div><strong>{attachment.name}</strong><small>{attachment.kind === 'audio' ? formatDuration(attachment.durationSeconds) : `${attachment.width ?? 'Image'} × ${attachment.height ?? ''}`}</small></div><button type="button" className="text-button studio-embed-action" onClick={() => onEmbed(attachment)}>Embed inline</button></div>
    {attachment.kind === 'audio' && (audio.url ? <audio controls src={audio.url} aria-label={`Play ${attachment.name}`} /> : <p className="journal-attachment-warning">{audio.unavailable ? 'This recording is not available in this browser’s local attachment storage.' : 'Loading voice memo…'}</p>)}
    {attachment.kind === 'image' && (image.url ? <img src={image.url} alt={attachment.name} /> : <p className="journal-attachment-warning">{image.unavailable ? 'This Firestore image is unavailable. Check your connection or add it again.' : 'Loading photo…'}</p>)}
  </article>
}

function StudioRecorder({ note, onSaved, onClose }: { note: NoteCard; onSaved: (attachment: JournalAttachment) => void; onClose: () => void }) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const animation = useRef<number | null>(null)
  const startedAt = useRef(0)

  const stopVisuals = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
    analyser.current = null
    if (audioContext.current) void audioContext.current.close().catch(() => {})
    audioContext.current = null
  }
  const stopStream = () => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null }
  useEffect(() => () => { if (recorder.current?.state === 'recording') recorder.current.stop(); stopStream(); stopVisuals() }, [])
  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [recording])

  const paintWaveform = () => {
    const element = canvas.current
    const meter = analyser.current
    if (!element || !meter) return
    const ratio = window.devicePixelRatio || 1
    const width = element.clientWidth
    const height = element.clientHeight
    if (element.width !== width * ratio || element.height !== height * ratio) { element.width = width * ratio; element.height = height * ratio }
    const context = element.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    const values = new Uint8Array(meter.fftSize)
    meter.getByteTimeDomainData(values)
    context.strokeStyle = '#ff9caf'
    context.lineWidth = 2
    context.lineCap = 'round'
    context.beginPath()
    values.forEach((value, index) => {
      const x = width * index / (values.length - 1)
      const y = height / 2 + ((value - 128) / 128) * height * .36
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
    animation.current = requestAnimationFrame(paintWaveform)
  }

  const start = async () => {
    setMessage('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMessage('Voice recording is not available in this browser.'); return }
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = microphone
      const AudioContextConstructor = window.AudioContext
      if (AudioContextConstructor) {
        const context = new AudioContextConstructor()
        const meter = context.createAnalyser()
        meter.fftSize = 1024
        context.createMediaStreamSource(microphone).connect(meter)
        audioContext.current = context
        analyser.current = meter
        void context.resume().catch(() => {})
        paintWaveform()
      }
      const chunks: BlobPart[] = []
      const next = new MediaRecorder(microphone)
      recorder.current = next
      startedAt.current = Date.now()
      setElapsed(0)
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      next.onerror = () => setMessage('The recording could not be completed. Please try again.')
      next.onstop = async () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
        setRecording(false)
        stopStream()
        stopVisuals()
        const blob = new Blob(chunks, { type: next.mimeType || 'audio/webm' })
        if (blob.size > MAX_AUDIO_BYTES) { setMessage('This recording is larger than 25 MB and was not saved. Please record a shorter note.'); return }
        const attachment: JournalAttachment = { id: makeId('audio'), kind: 'audio', name: `Voice memo ${formatDate(note.date, { month: 'short', day: 'numeric' })}`, mimeType: blob.type || 'audio/webm', size: blob.size, durationSeconds }
        try {
          await saveJournalAttachment(blob, attachment)
          onSaved(attachment)
          setMessage('Voice memo attached privately on this device.')
        } catch (error) { setMessage(error instanceof JournalAttachmentError ? error.message : 'The recording could not be saved locally.') }
      }
      next.start(250)
      setRecording(true)
    } catch {
      stopStream()
      stopVisuals()
      setMessage('Microphone access was not granted. Your note is unchanged.')
    }
  }
  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop()
  return <section className={`studio-recorder ${recording ? 'is-recording' : ''}`} aria-label="Voice memo recorder"><div className="studio-recorder-heading"><div><span className="eyebrow">Private audio</span><strong>{recording ? 'Recording voice memo' : 'Capture a voice memo'}</strong></div><span>{recording ? formatDuration(elapsed) : 'Saved on this device'}</span></div>
    <canvas ref={canvas} className="studio-waveform" aria-label={recording ? 'Live voice waveform' : 'Voice waveform preview'} />
    <div className="studio-recorder-actions">{recording ? <button type="button" className="button studio-stop-recording" onClick={stop}><Square size=".8125rem" />Stop</button> : <button type="button" className="button button-accent" onClick={start}><Mic size=".875rem" />Start recording</button>}<button type="button" className="text-button" disabled={recording} onClick={onClose}>Close recorder</button></div>
    {message && <p className="journal-attachment-feedback" role="status">{message}</p>}
  </section>
}

function StudioMediaTools({ note, firestoreUserId, onAddAttachment, onEmbed, canEdit, space, composer = false }: { note: NoteCard; firestoreUserId: string | null; onAddAttachment: (attachment: JournalAttachment) => void; onEmbed: (attachment: JournalAttachment) => void; canEdit: boolean; space: Pick<Space, 'id' | 'kind'>; composer?: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null)
  // The composer keeps media quiet until invited; a voice entry opens its recorder immediately.
  const [open, setOpen] = useState(() => note.noteKind === 'voice' || (!composer && !window.matchMedia('(max-width: 1080px)').matches))
  const [recorderOpen, setRecorderOpen] = useState(note.noteKind === 'voice')
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const addImage = async (file: File) => {
    setFeedback(null)
    if (!firestoreUserId) { setFeedback({ text: 'Sign in with Google before adding a Firestore image journal entry.', error: true }); return }
    try {
      const optimized = await optimizeJournalImage(file)
      const attachment: JournalAttachment = { id: makeId('image'), kind: 'image', storage: 'firestore', name: file.name || 'Journal image', mimeType: optimized.blob.type || 'image/webp', size: optimized.blob.size, width: optimized.width, height: optimized.height }
      const dataUrl = await blobAsDataUrl(optimized.blob)
      const { writeJournalImage } = await import('../lib/firestore')
      await writeJournalImage(firestoreUserId, attachment, dataUrl, space)
      onAddAttachment(attachment)
      setFeedback({ text: `Photo optimized to ${Math.ceil(optimized.blob.size / 1024)} KB and attached to this private Firestore journal entry.`, error: false })
    } catch (error) {
      console.warn('Unable to save journal image.', error)
      setFeedback({ text: journalImageUploadErrorMessage(error, space), error: true })
    }
  }
  const chooseImage = () => fileInput.current?.click()
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void addImage(file)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDropActive(false)
    const file = [...event.dataTransfer.files].find((candidate) => candidate.type.startsWith('image/'))
    if (file) void addImage(file)
    else setFeedback({ text: 'Drop an image file to add it to this journal entry.', error: true })
  }
  const attachments = allAttachments(note)
  return <section className={`studio-media-tools ${composer ? 'is-composer' : ''}`} aria-label="Capture tray">
    <details className="studio-media-disclosure" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary><span><span className="eyebrow">Capture</span><strong>Voice memo & photo</strong></span><ChevronDown size=".875rem" aria-hidden="true" /></summary>
      <div className="studio-media-content">
        <div className="studio-media-heading"><div><span className="eyebrow">Capture tray</span><h2>Voice memos & photos</h2></div><div className="studio-media-actions"><button type="button" className="button button-soft" disabled={!canEdit} onClick={() => setRecorderOpen((visible) => !visible)}><Mic size=".8125rem" />{recorderOpen ? 'Hide recorder' : 'Record voice'}</button><button type="button" className="button button-soft" disabled={!firestoreUserId || !canEdit} title={firestoreUserId ? 'Add a photo' : 'Sign in with Google to add a photo'} onClick={chooseImage}><Camera size=".8125rem" />Add photo</button></div></div>
        <input ref={fileInput} className="sr-only" aria-label="Choose a photo to attach" type="file" accept="image/*" capture="environment" onChange={onFile} />
        {recorderOpen && <StudioRecorder note={note} onSaved={onAddAttachment} onClose={() => setRecorderOpen(false)} />}
        <div className={`studio-photo-dropzone ${dropActive ? 'is-dragging' : ''} ${firestoreUserId ? '' : 'is-disabled'}`} onDragOver={(event) => { event.preventDefault(); if (firestoreUserId) setDropActive(true) }} onDragLeave={() => setDropActive(false)} onDrop={onDrop}>
          <ImagePlus size="1rem" /><span>{firestoreUserId ? 'Drop a photo here, or use Add photo. Images are optimized before private Firestore storage.' : 'Google sign-in is required for private Firestore photo journal entries.'}</span>
        </div>
        {attachments.length > 0 && <div className="studio-attachment-list">{attachments.map((attachment) => <AttachmentTile key={attachment.id} attachment={attachment} firestoreUserId={firestoreUserId} onEmbed={onEmbed} space={space} />)}</div>}
        {feedback && <p className={feedback.error ? 'journal-attachment-error' : 'journal-attachment-feedback'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      </div>
    </details>
  </section>
}
function StudioTool({ label, children, onClick, disabled = false }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="studio-tool" aria-label={label} title={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</button>
}

function StudioRichEditor({ note, dispatch, firestoreUserId, canEdit, space, members, currentMember }: { note: NoteCard; dispatch: Dispatch<JourneyAction>; firestoreUserId: string | null; canEdit: boolean; space: Pick<Space, 'id' | 'kind'>; members: SpaceMember[]; currentMember: SpaceMember }) {
  const editor = useRef<HTMLDivElement>(null)
  // Shared-note mentions are supportive controls, so keep them tucked away in the compact Journal layout until needed.
  const [mentionsOpen, setMentionsOpen] = useState(() => !window.matchMedia('(max-width: 1080px)').matches)
  const storedRichText = sanitizeJournalRichText(note.richText ?? initialJournalRichText(note.body))
  const update = (changes: Omit<Extract<JourneyAction, { type: 'update-note' }>, 'type' | 'id' | 'updatedAt'>) => dispatch({ type: 'update-note', id: note.id, ...changes, updatedAt: new Date().toISOString() })
  useEffect(() => {
    if (editor.current && document.activeElement !== editor.current && editor.current.innerHTML !== storedRichText) editor.current.innerHTML = storedRichText
  }, [note.id, storedRichText])
  useEffect(() => {
    if (note.title.trim() || journalRichTextToPlainText(storedRichText).trim()) return
    const frame = requestAnimationFrame(() => editor.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [note.id, note.title, storedRichText])
  const commit = () => {
    if (!editor.current) return
    const richText = sanitizeJournalRichText(editor.current.innerHTML)
    if (editor.current.innerHTML !== richText) editor.current.innerHTML = richText
    update({ richText, body: journalRichTextToPlainText(richText) })
  }
  const command = (name: string, value?: string) => {
    editor.current?.focus()
    document.execCommand(name, false, value)
    commit()
  }
  const formatBlock = (tag: 'h1' | 'h2' | 'blockquote' | 'pre' | 'p') => command('formatBlock', `<${tag}>`)
  const addChecklist = () => command('insertHTML', '<ul class="studio-checklist"><li><input type="checkbox" aria-label="Checklist item" contenteditable="false"> Checklist item</li></ul>')
  const addLink = () => {
    const url = window.prompt('Add a web link')?.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return
    command('createLink', url)
  }
  const mention = (name: string) => command('insertText', `@${name} `)
  const embed = (attachment: JournalAttachment) => {
    const icon = attachment.kind === 'audio' ? 'Voice memo' : 'Photo'
    command('insertHTML', `<p><span class="studio-inline-attachment" data-attachment-id="${attachment.id}" data-attachment-kind="${attachment.kind}" contenteditable="false">${icon}: ${attachment.name}</span><br></p>`)
  }
  const addAttachment = (attachment: JournalAttachment) => update({ attachments: [...(note.attachments ?? []), attachment] })
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    commit()
  }
  const onEditorDrop = (event: DragEvent<HTMLDivElement>) => {
    if (![...event.dataTransfer.files].some((file) => file.type.startsWith('image/'))) return
    event.preventDefault()
    const target = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')
    target?.click()
  }
  const onEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const checkbox = (event.target as Element).closest<HTMLInputElement>('input[type="checkbox"]')
    if (!checkbox) return
    window.setTimeout(() => {
      if (!checkbox.isConnected) return
      if (checkbox.checked) checkbox.setAttribute('checked', '')
      else checkbox.removeAttribute('checked')
      commit()
    })
  }
  return <>
    <div ref={editor} id="journal-body" className="studio-rich-editor" contentEditable={canEdit} role="textbox" aria-label="Your reflection" aria-multiline="true" data-placeholder="Write your reflection, capture a decision, or build a checklist…" suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: storedRichText }} onInput={commit} onBlur={commit} onPaste={onPaste} onDrop={onEditorDrop} onClick={onEditorClick} />
    <div className="journal-composer-dock" aria-label="Journal editor actions">
      <div className={`studio-toolbar ${canEdit ? '' : 'is-readonly'}`} role="toolbar" aria-label="Rich text formatting" aria-disabled={!canEdit}>
        <StudioTool label="Bold" onClick={() => command('bold')}><Bold size=".8125rem" /></StudioTool><StudioTool label="Italic" onClick={() => command('italic')}><Italic size=".8125rem" /></StudioTool><StudioTool label="Underline" onClick={() => command('underline')}><Underline size=".8125rem" /></StudioTool><StudioTool label="Highlight" onClick={() => command('hiliteColor', '#fff0a8')}><Highlighter size=".8125rem" /></StudioTool><span className="studio-toolbar-divider" aria-hidden="true" />
        <StudioTool label="Heading 1" onClick={() => formatBlock('h1')}><Heading1 size=".8125rem" /></StudioTool><StudioTool label="Heading 2" onClick={() => formatBlock('h2')}><Heading2 size=".8125rem" /></StudioTool><StudioTool label="Quote" onClick={() => formatBlock('blockquote')}><Quote size=".8125rem" /></StudioTool><StudioTool label="Bulleted list" onClick={() => command('insertUnorderedList')}><List size=".8125rem" /></StudioTool><StudioTool label="Numbered list" onClick={() => command('insertOrderedList')}><ListOrdered size=".8125rem" /></StudioTool><StudioTool label="Checklist" onClick={addChecklist}><ListChecks size=".8125rem" /></StudioTool><StudioTool label="Code block" onClick={() => formatBlock('pre')}><Code2 size=".8125rem" /></StudioTool><StudioTool label="Add link" onClick={addLink}><Link2 size=".8125rem" /></StudioTool><StudioTool label="Clear formatting" onClick={() => { command('removeFormat'); formatBlock('p') }}><Eraser size=".8125rem" /></StudioTool>
      </div>
      {space.kind === 'shared' && <details className="studio-mention-details" open={mentionsOpen} onToggle={(event) => setMentionsOpen((event.currentTarget as HTMLDetailsElement).open)}><summary><span>Notify people</span><small>Mention a Space member</small><ChevronDown size=".8125rem" aria-hidden="true" /></summary><div className="studio-mention-row" aria-label="Mention a Space member"><span>Notify</span>{members.filter((member) => member.name !== currentMember.name).slice(0, 5).map((member) => <button type="button" disabled={!canEdit} key={member.id} onClick={() => mention(member.name)}>@{member.name}</button>)}</div></details>}
      <StudioMediaTools note={note} firestoreUserId={firestoreUserId} onAddAttachment={addAttachment} onEmbed={embed} canEdit={canEdit} space={space} composer />
    </div>
  </>
}

function JournalEditor({ note, dispatch, storageAvailable, cloudSaveState, firestoreUserId, onDelete, canEdit, shared, space, members, currentMember }: { note: NoteCard; dispatch: Dispatch<JourneyAction>; storageAvailable: boolean; cloudSaveState: CloudSaveState; firestoreUserId: string | null; onDelete: (note: NoteCard) => void; canEdit: boolean; shared: boolean; space: Pick<Space, 'id' | 'kind'>; members: SpaceMember[]; currentMember: SpaceMember }) {
  const titleInput = useRef<HTMLTextAreaElement>(null)
  const richText = note.richText ?? initialJournalRichText(note.body)
  const words = journalRichTextWordCount(richText)
  const update = (changes: Omit<Extract<JourneyAction, { type: 'update-note' }>, 'type' | 'id' | 'updatedAt'>) => dispatch({ type: 'update-note', id: note.id, ...changes, updatedAt: new Date().toISOString() })
  const resizeTitle = (element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`
  }
  useEffect(() => { resizeTitle(titleInput.current) }, [note.id, note.title])
  return <section className="journal-detail journal-editor-detail" aria-label="Active journal entry">
    <div className="journal-detail-topbar journal-compose-topbar"><span className="journal-compose-kind"><FileText size=".8125rem" aria-hidden="true" />{shared ? 'Shared Space Note' : noteLabel(note.noteKind ?? 'text')}</span><div className="journal-compose-status"><SaveIndicator available={storageAvailable} shared={shared} cloud={cloudSaveState} />{canEdit && <CardDeleteAction card={note} onDelete={() => onDelete(note)} />}</div></div>
    <section className="journal-editor journal-composer-surface" aria-label={shared ? 'Space Notes studio' : 'Journal entry studio'}>
      <div className="journal-editor-meta"><span>{formatDate(note.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span><span>{shared ? `${note.authoredBy ? `Started by ${note.authoredBy} · ` : ''}${note.lastEditedBy ? `last edited by ${note.lastEditedBy}` : 'shared with this Space'}` : note.updatedAt ? 'Saved in your workspace' : 'Private to this browser'}</span></div>
      <label htmlFor="journal-title" className="sr-only">Note title</label><textarea ref={titleInput} id="journal-title" className="journal-title-input" rows={1} disabled={!canEdit} value={note.title} maxLength={160} placeholder={`Untitled ${shared ? 'Space Note' : noteLabel(note.noteKind ?? 'text').toLowerCase()}`} onInput={(event) => resizeTitle(event.currentTarget)} onChange={(event) => update({ title: event.target.value })} />
      <MetadataFields note={note} dispatch={dispatch} canEdit={canEdit} />
      <StudioRichEditor note={note} dispatch={dispatch} firestoreUserId={firestoreUserId} canEdit={canEdit} space={space} members={members} currentMember={currentMember} />
      <div className="journal-editor-footer"><span>{words} {words === 1 ? 'word' : 'words'} · {shared ? 'shared Space Note' : 'private journal studio'}</span><Link className="button button-accent" to="/" state={{ focusCardId: note.id }}>View on timeline<ArrowRight size=".8125rem" /></Link></div>
    </section>
  </section>
}

function JournalEntryBrowser({ notes, selected, firestoreUserId, onCreate, canEdit, shared }: { notes: NoteCard[]; selected: NoteCard; firestoreUserId: string | null; onCreate: (kind: JournalNoteKind) => void; canEdit: boolean; shared: boolean }) {
  return <section className="journal-entry-browser" aria-label="Journal entries"><div className="journal-entry-browser-heading"><div><span className="eyebrow">{shared ? 'Shared notes' : 'Your entries'}</span><h3>{shared ? 'Space Notes' : 'Journal entries'}</h3><span className="count-label">{notes.length} {notes.length === 1 ? 'entry' : 'entries'}</span></div><button type="button" className="icon-button" disabled={!canEdit} aria-label="Create text journal entry" title="Create text journal entry" onClick={() => onCreate('text')}><Plus size=".8125rem" /></button></div>
    <NoteList notes={notes} selectedId={selected.id} compact />
    <div className="journal-rail-capture"><button type="button" disabled={!canEdit} onClick={() => onCreate('voice')}><Mic size=".75rem" />Voice</button><button type="button" disabled={!firestoreUserId || !canEdit} title={firestoreUserId ? 'Create photo journal entry' : 'Sign in with Google to create a photo journal entry'} onClick={() => onCreate('image')}><Camera size=".75rem" />Photo</button></div>
  </section>
}

export function JournalWorkspace({ cards, cardId, dispatch, onNavigate, onDeleteCard, storageAvailable, cloudSaveState, firestoreUserId, space, currentMember, members, scope, onScopeChange, canEdit }: { cards: JourneyCard[]; cardId?: string; dispatch: Dispatch<JourneyAction>; onNavigate: (destination: Destination) => void; onDeleteCard: (card: JourneyCard) => void; storageAvailable: boolean; cloudSaveState: CloudSaveState; firestoreUserId: string | null; space: Space; currentMember: SpaceMember; members: SpaceMember[]; scope: 'all' | 'assigned'; onScopeChange: (scope: 'all' | 'assigned') => void; canEdit: boolean }) {
  const [query] = useSearchParams()
  const creationRequested = useRef(false)
  const notes = cards.filter((card): card is NoteCard => card.type === 'note' && (scope === 'all' || cardAssignedTo(card, currentMember)))
  const mostRecent = [...notes].sort((first, second) => updated(second).getTime() - updated(first).getTime())[0]
  const selected = cardId ? notes.find((note) => note.id === cardId) : mostRecent
  const shared = space.kind === 'shared'
  const create = (kind: JournalNoteKind) => {
    if (!canEdit) return
    const card: NoteCard = { id: makeId('note'), type: 'note', noteKind: kind, title: '', body: '', richText: '<p><br></p>', tags: [], pinned: false, date: localDate(), side: 'right', context: shared ? `A shared note in ${space.name}` : 'A private journal entry', category: shared ? 'Work' : 'Personal', authoredBy: currentMember.name, lastEditedBy: currentMember.name, updatedAt: new Date().toISOString() }
    dispatch({ type: 'add-card', card })
    onNavigate({ page: 'journal', cardId: card.id })
  }
  const wantsNewTextEntry = query.get('new') === 'text' || query.get('create') === 'menu'
  useEffect(() => {
    if (!canEdit || creationRequested.current || (!wantsNewTextEntry && notes.length)) return
    creationRequested.current = true
    create('text')
  // A root Journal route is the only place this can run; creation navigates to the new entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNewTextEntry, notes.length, canEdit])

  return <div className="workspace-content journal-workspace-content">
    {selected ? <><div className="workspace-control-row">
      <div className="workspace-selector journal-selector"><label htmlFor="journal-entry-select">Journal entry</label><select id="journal-entry-select" value={selected.id} onChange={(event) => onNavigate({ page: 'journal', cardId: event.target.value })}>
        {[...notes].sort((first, second) => updated(second).getTime() - updated(first).getTime()).map((note) => <option key={note.id} value={note.id}>{displayTitle(note)}</option>)}
      </select></div>
      <TeamScopeToggle scope={scope} memberName={currentMember.name} onChange={onScopeChange} />
    </div>
      <JournalHero note={selected} entryCount={notes.length} shared={shared} cloudSaveState={cloudSaveState} />
      <div className="workspace-desktop-split journal-workspace-split"><section className="workspace-panel journal-editor-panel"><JournalEditor note={selected} dispatch={dispatch} storageAvailable={storageAvailable} cloudSaveState={cloudSaveState} firestoreUserId={firestoreUserId} canEdit={canEdit} shared={shared} space={space} members={members} currentMember={currentMember} onDelete={(note) => { onDeleteCard(note); onNavigate({ page: 'journal' }) }} /></section>
        <aside className="workspace-desktop-aside journal-workspace-aside" aria-label="Journal context"><section className="workspace-insight-card journal-insight-card"><span className="eyebrow"><FileText size={11} />Journal entry</span><h3>At a glance</h3><dl className="workspace-insight-list"><div><dt>Entry date</dt><dd>{shortDate(selected.date)}</dd></div><div><dt>Category</dt><dd>{selected.category || 'Personal'}</dd></div><div><dt>Tags</dt><dd>{selected.tags.length ? selected.tags.map((tag) => `#${tag}`).join(', ') : 'No tags yet'}</dd></div><div><dt>Reminder</dt><dd>{selected.reminderAt ? formatDate(selected.reminderAt.slice(0, 10), { month: 'short', day: 'numeric' }) : 'No reminder'}</dd></div></dl></section>
          <JournalEntryBrowser notes={notes} selected={selected} firestoreUserId={firestoreUserId} onCreate={create} canEdit={canEdit} shared={shared} />
          <p className="workspace-fineprint"><FileText size=".75rem" />{shared ? cloudSaveState === 'local-only' ? 'Team notes stay on this device until you continue with Google. Keep sensitive reflections in Personal Space.' : 'Team notes sync with this Space through your Google account when connected. Keep sensitive reflections in Personal Space.' : 'Text stays in your workspace. Voice stays on this device; images are private Firestore journal entries.'}</p>
        </aside>
      </div></>
      : <section className="journal-studio-pending" aria-live="polite">{canEdit ? 'Opening a fresh journal entry…' : shared ? 'This shared Space has no team notes yet.' : 'Your journal is empty.'}</section>}
  </div>
}
