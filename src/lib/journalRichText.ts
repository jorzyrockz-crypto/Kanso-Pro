const ALLOWED_TAGS = new Set(['a', 'blockquote', 'br', 'code', 'em', 'figure', 'figcaption', 'h1', 'h2', 'li', 'mark', 'ol', 'p', 'pre', 'span', 'strong', 'u', 'ul', 'input'])
const BLOCK_TAGS = new Set(['blockquote', 'figcaption', 'h1', 'h2', 'li', 'p', 'pre'])

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function safeHref(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

/**
 * Journal rich text stays deliberately small and portable: only formatting emitted by
 * the studio is persisted, no scripts, styles, data URLs, or arbitrary attributes.
 */
export function sanitizeJournalRichText(value: string) {
  if (typeof document === 'undefined') return ''
  const template = document.createElement('template')
  template.innerHTML = value.slice(0, 60_000)
  for (const element of [...template.content.querySelectorAll('*')]) {
    const tag = element.tagName.toLowerCase()
    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'].includes(tag)) {
      element.remove()
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...[...element.childNodes])
      continue
    }
    const hrefValue = element.getAttribute('href')
    const checklist = element.classList.contains('studio-checklist')
    const inlineAttachment = element.classList.contains('studio-inline-attachment')
    const attachmentId = element.getAttribute('data-attachment-id')
    const attachmentKind = element.getAttribute('data-attachment-kind')
    const inputType = element.getAttribute('type')
    const checked = element.hasAttribute('checked')
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name)
    if (tag === 'a') {
      const href = safeHref(hrefValue ?? '')
      if (href) element.setAttribute('href', href)
      else { element.replaceWith(...[...element.childNodes]); continue }
    }
    if (tag === 'ul' && checklist) element.className = 'studio-checklist'
    if (tag === 'span' && inlineAttachment) {
      element.className = 'studio-inline-attachment'
      if (attachmentId && /^[a-z0-9_-]{3,120}$/i.test(attachmentId) && ['audio', 'image'].includes(attachmentKind ?? '')) {
        element.setAttribute('data-attachment-id', attachmentId)
        element.setAttribute('data-attachment-kind', attachmentKind!)
        element.setAttribute('contenteditable', 'false')
      } else element.replaceWith(...[...element.childNodes])
    }
    if (tag === 'input') {
      if (inputType === 'checkbox') {
        element.setAttribute('type', 'checkbox')
        element.setAttribute('aria-label', 'Checklist item')
        element.setAttribute('contenteditable', 'false')
        if (checked) element.setAttribute('checked', '')
      } else element.remove()
    }
  }
  return template.innerHTML
}

export function initialJournalRichText(body: string) {
  if (!body.trim()) return '<p><br></p>'
  return `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`
}

export function journalRichTextToPlainText(value: string) {
  if (typeof document === 'undefined') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const holder = document.createElement('div')
  holder.innerHTML = sanitizeJournalRichText(value)
  for (const element of [...holder.querySelectorAll('*')]) {
    if (BLOCK_TAGS.has(element.tagName.toLowerCase())) element.before(document.createTextNode(' '))
    if (element.tagName.toLowerCase() === 'input') element.replaceWith(document.createTextNode(element.hasAttribute('checked') ? 'completed' : 'to do'))
  }
  return (holder.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function journalRichTextWordCount(value: string) {
  const plainText = journalRichTextToPlainText(value)
  return plainText ? plainText.split(/\s+/).length : 0
}
