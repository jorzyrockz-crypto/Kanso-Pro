import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useId } from 'react'
import type { AppearanceController } from '../lib/useAppearance'
import { SaveIndicator } from './Common'

const choices = [
  { mode: 'light', label: 'Light', hint: 'Always bright', Icon: Sun },
  { mode: 'dark', label: 'Dark', hint: 'Easy on the eyes', Icon: Moon },
  { mode: 'auto', label: 'Auto', hint: 'Follow your device', Icon: Monitor },
] as const

export function ColorModePicker({ appearance }: { appearance: AppearanceController }) {
  const id = useId()
  return <div className="appearance-control">
    <fieldset className="appearance-fieldset" aria-describedby={`${id}-hint`}>
      <legend>Color mode</legend>
      <p id={`${id}-hint`} className="appearance-hint">Choose a look for the whole app. Auto follows your device’s Light or Dark setting, including when it changes.</p>
      <div className="appearance-options">{choices.map(({ mode, label, hint, Icon }) => <label key={mode} className={`appearance-option appearance-option-${mode}`}>
        <input type="radio" name={`${id}-color-mode`} value={mode} checked={appearance.mode === mode} onChange={() => appearance.setMode(mode)} aria-labelledby={`${id}-${mode}`} />
        <span className={`appearance-preview preview-${mode}`} aria-hidden="true"><span className="preview-chrome"><i /><i /><i /></span><span className="preview-layout"><span /><span><i /><i /><i /></span></span><span className="appearance-selected"><Check size="0.75rem" /></span></span>
        <span className="appearance-option-title" id={`${id}-${mode}`}><Icon size="0.9375rem" aria-hidden="true" />{label}</span><span className="appearance-option-hint">{hint}</span>
      </label>)}</div>
    </fieldset>
    <div className="settings-preference-status"><SaveIndicator available={appearance.storageAvailable} /><span role="status" className="appearance-status">{appearance.mode === 'auto' ? 'Auto · ' : ''}{appearance.scheme === 'dark' ? 'Dark' : 'Light'} appearance{appearance.mode === 'auto' ? ' on this device' : ' selected'}</span></div>
  </div>
}
