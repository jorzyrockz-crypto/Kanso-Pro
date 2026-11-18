import { Check, CloudSun, MoonStar, Sunrise, Waves } from 'lucide-react'
import { useId } from 'react'
import type { BackgroundGradient } from '../lib/appearance'
import type { AppearanceController } from '../lib/useAppearance'

const choices: { background: BackgroundGradient; label: string; hint: string; Icon: typeof CloudSun }[] = [
  { background: 'sky', label: 'Sky', hint: 'The familiar blue canvas', Icon: CloudSun },
  { background: 'dawn', label: 'Dawn', hint: 'Warm peach and lavender', Icon: Sunrise },
  { background: 'lagoon', label: 'Lagoon', hint: 'Cool teal and aqua', Icon: Waves },
  { background: 'twilight', label: 'Twilight', hint: 'Soft violet and indigo', Icon: MoonStar },
]

export function GradientBackgroundPicker({ appearance }: { appearance: AppearanceController }) {
  const id = useId()
  return <div className="appearance-control gradient-background-control">
    <fieldset className="appearance-fieldset" aria-describedby={`${id}-hint`}>
      <legend>Background gradient</legend>
      <p id={`${id}-hint`} className="appearance-hint">Choose the canvas behind your planning space. The selected gradient adapts when you use Dark or Auto mode, while month artwork stays softly layered above it.</p>
      <div className="appearance-options gradient-background-options">{choices.map(({ background, label, hint, Icon }) => <label key={background} className={`appearance-option gradient-background-option gradient-background-option-${background}`}>
        <input type="radio" name={`${id}-background-gradient`} value={background} checked={appearance.background === background} onChange={() => appearance.setBackground(background)} aria-labelledby={`${id}-${background}`} />
        <span className={`appearance-preview gradient-background-preview preview-background-${background}`} aria-hidden="true"><span className="gradient-preview-orb gradient-preview-orb-one" /><span className="gradient-preview-orb gradient-preview-orb-two" /><span className="appearance-selected"><Check size="0.75rem" /></span></span>
        <span className="appearance-option-title" id={`${id}-${background}`}><Icon size="0.9375rem" aria-hidden="true" />{label}</span><span className="appearance-option-hint">{hint}</span>
      </label>)}</div>
    </fieldset>
  </div>
}
