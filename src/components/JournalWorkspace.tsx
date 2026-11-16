import { ArrowLeft, ArrowRight, Check, Clock3, FileText, ImagePlus, Mic, Plus, Sparkles, Square, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ChangeEvent, Dispatch } from 'react'
import { FOCUS_DATE } from '../data'
import { getJournalAttachment, JournalAttachmentError, saveJournalAttachment } from '../lib/journalAttachments'
import { blobAsDataUrl, JournalImageError, optimizeJournalImage } from '../lib/journalImages'
import { formatDate, makeId, shortDate } from '../lib/journey'
import type { Destination, JournalAttachment, JournalNoteKind, JourneyAction, JourneyCard, NoteCard } from '../types'
import { SaveIndicator } from './Common'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const categoryOptions = ['Personal', 'School', 'Work', 'Ideas']

function noteLabel(kind: JournalNoteKind) {
  return kind === 'voice' ? 'Voice note' : kind === 'image' ? 'Image note' : 'Text note'
}

function displayTitle(note: NoteCard) {
  return note.title.trim() || `Untitled ${noteLabel(note.noteKind ?? 'text').toLowerCase()}`
}

function updated(note: NoteCard) {
  return note.updatedAt ? new Date(note.updatedAt) : new Date(`${note.date}T${note.time || '12:00'}`)
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

function useFirestoreImageUrl(firestoreUserId: string | null, attachment?: JournalAttachment) {
  const [url, setUrl] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    setUrl(null)
    setUnavailable(false)
    if (!firestoreUserId || !attachment || attachment.kind !== 'image' || attachment.storage !== 'firestore') return
    void import('../lib/firestore').then(({ readJournalImage }) => readJournalImage(firestoreUserId, attachment.id)).then((dataUrl) => {
      if (!active) return
      if (!dataUrl) { setUnavailable(true); return }
      setUrl(dataUrl)
    }).catch(() => active && setUnavailable(true))
    return () => { active = false }
  }, [attachment?.id, attachment?.storage, firestoreUserId])
  return { url, unavailable }
}

function JournalHub({ notes, onCreate, imageUploadAvailable }: { notes: NoteCard[]; onCreate: (kind: JournalNoteKind) => void; imageUploadAvailable: boolean }) {
  const [query] = useSearchParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const showPicker = query.get('create') === 'menu'
  const normalized = search.trim().toLocaleLowerCase()
  const visible = notes.filter((note) => !normalized || [note.title, note.body, note.category, ...note.tags].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized))
    .sort((a, b) => updated(b).getTime() - updated(a).getTime())

  const choose = (kind: JournalNoteKind) => onCreate(kind)
  return <div className="journal-hub">
    <div className="journal-hub-bar">
      <label className="journal-search"><span className="sr-only">Search journal notes</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, tags, or categories" /><span aria-hidden="true">⌕</span></label>
      <button type="button" className="button journal-create-trigger" onClick={() => navigate('/journal?create=menu')}><Plus size=".875rem" />Create note</button>
    </div>

    {showPicker && <section className="journal-note-picker" aria-labelledby="journal-picker-title">
      <div className="journal-picker-heading"><div><span className="eyebrow">Choose a format</span><h2 id="journal-picker-title">Start a private note</h2></div><button type="button" className="icon-button" aria-label="Close note type picker" onClick={() => navigate('/journal')}><X size="1rem" /></button></div>
      <div className="journal-type-grid">
        <button type="button" className="journal-type-card type-text" onClick={() => choose('text')}><FileText size="1.125rem" /><strong>Text note</strong><span>Write and save a thought.</span></button>
        <button type="button" className="journal-type-card type-voice" onClick={() => choose('voice')}><Mic size="1.125rem" /><strong>Voice note</strong><span>Record privately on this device.</span></button>
        <button type="button" className="journal-type-card type-image" disabled={!imageUploadAvailable} onClick={() => choose('image')}><ImagePlus size="1.125rem" /><strong>Image note</strong><span>{imageUploadAvailable ? 'Keep a visual reference close.' : 'Sign in with Google to store images privately.'}</span></button>
        <div className="journal-type-card type-ai" aria-label="AI Assist is a future upgrade"><Sparkles size="1.125rem" /><strong>AI Assist</strong><span>Coming in a future upgrade.</span><small>Nothing is sent from your device.</small></div>
      </div>
    </section>}

    <section className="journal-recent" aria-labelledby="journal-recent-heading">
      <div className="panel-heading"><div><span className="eyebrow">Your private library</span><h2 id="journal-recent-heading">Recent notes</h2></div><span className="count-label">{visible.length} {visible.length === 1 ? 'note' : 'notes'}</span></div>
      {visible.length ? <div className="journal-note-list">{visible.map((note) => <Link key={note.id} className={`journal-note-summary note-${note.noteKind ?? 'text'}`} to={`/journal/${encodeURIComponent(note.id)}`} aria-label={`Open ${noteLabel(note.noteKind ?? 'text')}: ${displayTitle(note)}`}>
        <span className="journal-note-kind">{note.noteKind === 'voice' ? <Mic size="1rem" /> : note.noteKind === 'image' ? <ImagePlus size="1rem" /> : <FileText size="1rem" />}</span>
        <span className="journal-note-copy"><strong>{displayTitle(note)}</strong><small>{note.noteKind === 'voice' && note.attachment?.durationSeconds ? `${Math.ceil(note.attachment.durationSeconds)} sec recording` : note.body.trim() || noteLabel(note.noteKind ?? 'text')}</small><em>{note.category || 'Personal'} · {shortDate(note.date)}</em></span>
        <span className="journal-note-tags">{note.tags.slice(0, 2).map((tag) => <i key={tag}>#{tag}</i>)}</span><ArrowRight size=".875rem" aria-hidden="true" />
      </Link>)}</div> : <div className="journal-empty"><FileText size="1.25rem" /><p>No notes match that search. Try another word, tag, or category.</p></div>}
    </section>
    <p className="journal-private-note"><Check size=".75rem" />Notes, recordings, and images stay in this browser on this device.</p>
  </div>
}

function MetadataFields({ note, dispatch }: { note: NoteCard; dispatch: Dispatch<JourneyAction> }) {
  const update = (changes: Omit<Extract<JourneyAction, { type: 'update-note' }>, 'type' | 'id' | 'updatedAt'>) => dispatch({ type: 'update-note', id: note.id, ...changes, updatedAt: new Date().toISOString() })
  return <div className="journal-metadata-fields">
    <label><Tag size=".75rem" />Tags<input aria-label="Tags, separated by commas" value={note.tags.join(', ')} placeholder="e.g. personal, ideas" onChange={(event) => update({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12) })} /></label>
    <label><span aria-hidden="true">⌂</span>Category<select aria-label="Note category" value={note.category ?? 'Personal'} onChange={(event) => update({ category: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label><Clock3 size=".75rem" />Reminder<input aria-label="Note reminder" type="datetime-local" value={note.reminderAt ?? ''} onChange={(event) => update({ reminderAt: event.target.value })} /></label>
  </div>
}

function VoiceEditor({ note, dispatch }: { note: NoteCard; dispatch: Dispatch<JourneyAction> }) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const startedAt = useRef(0)
  const { url, unavailable } = useAttachmentUrl(note.attachment)

  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), [])
  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [recording])

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop()
  const start = async () => {
    setMessage('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMessage('Voice recording is not available in this browser.'); return }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: BlobPart[] = []
      const next = new MediaRecorder(stream.current)
      recorder.current = next
      startedAt.current = Date.now()
      setElapsed(0)
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      next.onerror = () => setMessage('The recording could not be completed. Please try again.')
      next.onstop = async () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
        setRecording(false)
        stream.current?.getTracks().forEach((track) => track.stop())
        stream.current = null
        const blob = new Blob(chunks, { type: next.mimeType || 'audio/webm' })
        if (blob.size > MAX_AUDIO_BYTES) { setMessage('This recording is larger than 25 MB and was not saved. Please record a shorter note.'); return }
        const attachment: JournalAttachment = { id: makeId('audio'), kind: 'audio', name: `Voice note ${formatDate(note.date, { month: 'short', day: 'numeric' })}`, mimeType: blob.type || 'audio/webm', size: blob.size, durationSeconds }
        try {
          await saveJournalAttachment(blob, attachment)
          dispatch({ type: 'update-note', id: note.id, attachment, noteKind: 'voice', updatedAt: new Date().toISOString() })
          setMessage('Recording saved privately on this device.')
        } catch (error) { setMessage(error instanceof JournalAttachmentError ? error.message : 'The recording could not be saved locally.') }
      }
      next.start()
      setRecording(true)
    } catch {
      setMessage('Microphone access was not granted. Your note is unchanged.')
    }
  }

  return <section className="journal-voice-editor" aria-labelledby="voice-note-heading"><div className="journal-editor-section-heading"><div><span className="eyebrow">Private audio</span><h2 id="voice-note-heading">{recording ? 'Recording voice note' : 'Voice note'}</h2></div><span>{recording ? `${elapsed}s` : note.attachment?.durationSeconds ? `${Math.ceil(note.attachment.durationSeconds)} sec` : 'Ready to record'}</span></div>
    <div className={`journal-waveform ${recording ? 'is-recording' : ''}`} aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ height: `${22 + ((index * 13) % 55)}%` }} />)}</div>
    <div className="journal-recorder-controls">{recording ? <button type="button" className="button button-dark" onClick={stop}><Square size=".8125rem" />Stop recording</button> : <button type="button" className="button button-accent" onClick={start}><Mic size=".875rem" />{note.attachment ? 'Record again' : 'Start recording'}</button>}{url && <audio controls src={url} aria-label="Play voice note" />}{unavailable && <p className="journal-attachment-warning">This recording is not available in this browser’s local attachment storage.</p>}</div>
    {message && <p className="journal-attachment-feedback" role="status">{message}</p>}
    <label className="journal-detail-label" htmlFor="voice-note-body">Private context</label><textarea id="voice-note-body" value={note.body} maxLength={20000} placeholder="Add a private note about this recording…" onChange={(event) => dispatch({ type: 'update-note', id: note.id, body: event.target.value, updatedAt: new Date().toISOString() })} />
  </section>
}

function ImageEditor({ note, dispatch, firestoreUserId }: { note: NoteCard; dispatch: Dispatch<JourneyAction>; firestoreUserId: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const { url, unavailable } = useFirestoreImageUrl(firestoreUserId, note.attachment)
  const choose = () => input.current?.click()
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!firestoreUserId) { setMessage('Sign in with Google before adding a Firestore image note.'); return }
    try {
      const optimized = await optimizeJournalImage(file)
      const attachment: JournalAttachment = { id: makeId('image'), kind: 'image', storage: 'firestore', name: file.name || 'Journal image', mimeType: optimized.blob.type || 'image/webp', size: optimized.blob.size, width: optimized.width, height: optimized.height }
      const dataUrl = await blobAsDataUrl(optimized.blob)
      const { writeJournalImage } = await import('../lib/firestore')
      await writeJournalImage(firestoreUserId, attachment, dataUrl)
      dispatch({ type: 'update-note', id: note.id, attachment, noteKind: 'image', updatedAt: new Date().toISOString() })
      setMessage(`Image optimized to ${Math.ceil(optimized.blob.size / 1024)} KB and saved to your private Firestore workspace.`)
    } catch (error) { setMessage(error instanceof JournalImageError ? error.message : 'The image could not be saved to private Firestore storage.') }
  }
  return <section className="journal-image-editor" aria-labelledby="image-note-heading"><div className="journal-editor-section-heading"><div><span className="eyebrow">Private Firestore image</span><h2 id="image-note-heading">Image note</h2></div><button type="button" className="button button-soft" disabled={!firestoreUserId} onClick={choose}><ImagePlus size=".875rem" />{note.attachment ? 'Replace image' : 'Choose image'}</button></div>
    <input ref={input} className="sr-only" type="file" accept="image/*" onChange={onFile} />
    {url ? <img className="journal-note-image" src={url} alt={note.title || 'Journal attachment'} /> : firestoreUserId ? <button type="button" className="journal-image-dropzone" onClick={choose}><ImagePlus size="1.5rem" /><strong>Add an image</strong><span>Images are automatically optimized before private Firestore storage.</span></button> : <div className="journal-image-sign-in"><ImagePlus size="1.5rem" /><strong>Google sign-in required</strong><span>Image notes are optimized and saved only in your private Firestore workspace.</span></div>}
    {unavailable && <p className="journal-attachment-warning">This Firestore image is unavailable. Check your connection or add the image again.</p>}
    {message && <p className="journal-attachment-feedback" role="status">{message}</p>}
    <label className="journal-detail-label" htmlFor="image-note-body">Private context</label><textarea id="image-note-body" value={note.body} maxLength={20000} placeholder="What do you want to remember about this image?" onChange={(event) => dispatch({ type: 'update-note', id: note.id, body: event.target.value, updatedAt: new Date().toISOString() })} />
  </section>
}

function JournalEditor({ note, dispatch, storageAvailable, firestoreUserId }: { note: NoteCard; dispatch: Dispatch<JourneyAction>; storageAvailable: boolean; firestoreUserId: string | null }) {
  const kind = note.noteKind ?? 'text'
  const update = (changes: Omit<Extract<JourneyAction, { type: 'update-note' }>, 'type' | 'id' | 'updatedAt'>) => dispatch({ type: 'update-note', id: note.id, ...changes, updatedAt: new Date().toISOString() })
  const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0
  return <div className="journal-detail">
    <div className="journal-detail-topbar"><Link className="text-button" to="/journal"><ArrowLeft size=".75rem" />All notes</Link><span>{noteLabel(kind)}</span><SaveIndicator available={storageAvailable} /></div>
    <section className="journal-editor journal-paper">
      <div className="journal-editor-meta"><span>{formatDate(note.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span><span>{note.updatedAt ? 'Updated just now' : 'Private to this browser'}</span></div>
      <label htmlFor="journal-title" className="sr-only">Note title</label><input id="journal-title" className="journal-title-input" value={note.title} maxLength={160} placeholder={`Untitled ${noteLabel(kind).toLowerCase()}`} onChange={(event) => update({ title: event.target.value })} />
      <MetadataFields note={note} dispatch={dispatch} />
      {kind === 'voice' ? <VoiceEditor note={note} dispatch={dispatch} /> : kind === 'image' ? <ImageEditor note={note} dispatch={dispatch} firestoreUserId={firestoreUserId} /> : <><label className="journal-detail-label" htmlFor="journal-body">Your reflection</label><textarea id="journal-body" className="journal-body-input" rows={12} value={note.body} maxLength={20000} placeholder="What’s on your mind today?" onChange={(event) => update({ body: event.target.value })} /><div className="journal-editor-footer"><span>{words} {words === 1 ? 'word' : 'words'} · Private to this browser</span><Link className="button button-accent" to="/" state={{ focusCardId: note.id }}>View on timeline<ArrowRight size=".8125rem" /></Link></div></>}
    </section>
    <section className="journal-ai-future" aria-labelledby="journal-ai-heading"><Sparkles size="1rem" /><div><span className="eyebrow">Future upgrade</span><h2 id="journal-ai-heading">AI Assist</h2><p>Summaries, rewrites, and transcription are planned for a future release. Nothing from this note is sent anywhere today.</p></div><span>Coming soon</span></section>
  </div>
}

export function JournalWorkspace({ cards, cardId, dispatch, onNavigate, storageAvailable, firestoreUserId }: { cards: JourneyCard[]; cardId?: string; dispatch: Dispatch<JourneyAction>; onNavigate: (destination: Destination) => void; storageAvailable: boolean; firestoreUserId: string | null }) {
  const notes = cards.filter((card): card is NoteCard => card.type === 'note')
  const selected = cardId ? notes.find((note) => note.id === cardId) : undefined
  const create = (kind: JournalNoteKind) => {
    const card: NoteCard = { id: makeId('note'), type: 'note', noteKind: kind, title: '', body: '', tags: [], pinned: false, date: FOCUS_DATE, side: 'right', context: 'A private journal note', category: 'Personal', updatedAt: new Date().toISOString() }
    dispatch({ type: 'add-card', card })
    onNavigate({ page: 'journal', cardId: card.id })
  }
  if (selected) return <JournalEditor note={selected} dispatch={dispatch} storageAvailable={storageAvailable} firestoreUserId={firestoreUserId} />
  return <JournalHub notes={notes} onCreate={create} imageUploadAvailable={!!firestoreUserId} />
}
