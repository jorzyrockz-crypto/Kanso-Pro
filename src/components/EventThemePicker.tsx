import { Check, ImageOff, Palette, Sparkles } from 'lucide-react'
import { useId } from 'react'
import type { OccasionChoice } from '../types'
import { occasionLabel, OCCASION_OPTIONS, OCCASION_THEMES, resolveOccasion } from '../lib/occasions'
import { OccasionArtwork } from './OccasionArtwork'

export function EventThemePicker({ value, title, holiday = false, onChange, compact = false, preview = false }: {
  value: OccasionChoice
  title: string
  holiday?: boolean
  onChange: (value: OccasionChoice) => void
  compact?: boolean
  preview?: boolean
}) {
  const id = useId()
  const theme = resolveOccasion({ title, holiday, occasion: value })
  const label = occasionLabel(theme)
  return <fieldset className={`occasion-picker ${compact ? 'occasion-picker-compact' : ''}`} aria-describedby={`${id}-hint`}>
    <legend><Palette size="0.875rem" />Occasion background</legend>
    <p className="occasion-picker-hint" id={`${id}-hint`}>Let the title suggest a look, pick your own, or leave the illustration off.</p>
    <div className="occasion-options">{OCCASION_OPTIONS.map((option) => <label className={`occasion-option ${value === option.value ? 'is-selected' : ''}`} key={option.value}>
      <input type="radio" name={`occasion-${id}`} value={option.value} aria-label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span className={`occasion-swatch swatch-${option.value}`} aria-hidden="true">
        {option.value === 'auto' ? <Sparkles size="1.4375rem" /> : option.value === 'none' ? <ImageOff size="1.4375rem" /> : <OccasionArtwork theme={option.value} miniature />}
        {value === option.value && <span className="occasion-option-check"><Check size="0.6875rem" /></span>}
      </span>
      <span className="occasion-option-label">{option.label}</span>
    </label>)}</div>
    {preview && <div className={`occasion-preview ${theme !== 'none' ? `occasion-surface occasion-${theme}` : ''}`} aria-label="Event background preview" data-occasion={theme}>
      {theme !== 'none' && <OccasionArtwork theme={theme} />}
      <div className="occasion-preview-copy"><span className="occasion-preview-eyebrow">A little preview</span><h3>{title.trim() || 'Your next special moment'}</h3>
        <p>{theme === 'none' ? 'A clean canvas. All the attention on your plans.' : OCCASION_THEMES[theme].description}</p></div>
    </div>}
    <p className="occasion-selection" role="status">{value === 'auto' ? `Automatic · ${label}` : `${label} selected`}{value === 'auto' && theme === 'none' && ' — try a title like “Mia’s birthday”.'}</p>
    <span className="occasion-vector-note">Original SVG artwork · stays sharp at every size</span>
  </fieldset>
}
