import type { CSSProperties, ReactNode } from 'react'
import { monthScene } from '../lib/months'
import type { MonthScene, MonthSceneId } from '../lib/months'

export function monthPalette(scene: MonthScene): CSSProperties {
  return { '--month-canvas': scene.canvas, '--month-wash': scene.wash, '--month-ink': scene.ink, '--month-accent': scene.accent, '--month-warm': scene.warm } as CSSProperties
}

function Leaf({ x, y, rotate = 0, scale = 1, fill = 'var(--month-accent)' }: { x: number; y: number; rotate?: number; scale?: number; fill?: string }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}><path d="M0 0C-58-10-73-53-62-77-25-77 2-47 0 0Z" fill={fill} /><path d="M0 0-48-60" fill="none" stroke="var(--month-ink)" strokeWidth="1.5" opacity=".6" /></g>
}
function Branch({ x, y, rotate = 0, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
    <path d="M0 150C-20 75 18-4 3-108" fill="none" stroke="var(--month-ink)" strokeWidth="3" strokeLinecap="round" />
    <Leaf x={-1} y={-57} rotate={-12} scale={.8} /><Leaf x={3} y={-10} rotate={100} scale={.95} />
    <Leaf x={-6} y={37} rotate={-16} /><Leaf x={-7} y={82} rotate={107} scale={1.05} />
  </g>
}
function Star({ x, y, size = 14, fill = 'var(--month-warm)' }: { x: number; y: number; size?: number; fill?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${size / 20})`} d="m0-20 5 14 15 6-15 5-5 15-5-15-15-5 15-6z" fill={fill} />
}
function Heart({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return <path transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} d="M0 27C-11 16-36 1-29-17-21-37-2-28 0-17 5-31 27-36 32-17 38 1 12 18 0 27Z" fill="var(--month-accent)" />
}
function Flower({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
    {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="0" cy="-27" rx="18" ry="29" transform={`rotate(${angle})`} fill="var(--month-accent)" />)}
    <circle r="15" fill="var(--month-warm)" /><circle r="6" fill="var(--month-ink)" opacity=".55" />
  </g>
}
function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${scale})`} d="M-77 16c-31 0-34-46-5-51-2-44 60-65 82-23 33-27 75-3 71 27 43-2 45 47 10 47z" fill="var(--month-accent)" />
}
function Waves({ y, count = 3 }: { y: number; count?: number }) {
  return <g fill="none" stroke="var(--month-ink)" strokeWidth="2" strokeLinecap="round" opacity=".65">{Array.from({ length: count }, (_, index) => <path key={index} d={`M36 ${y + index * 26}c60-25 85 21 146 0s85 21 146 0 85 21 146 0`} />)}</g>
}
function Book({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
    <path d="M-113-57c45-18 77-14 113 7 37-21 69-25 113-7v136C67 63 37 67 0 88c-37-21-68-25-113-9z" fill="var(--month-ink)" />
    <path d="M-105-67c43-15 73-10 105 10v132c-34-21-66-24-105-12zm105 10c32-20 62-25 105-10v130C66 51 34 54 0 75z" fill="var(--month-warm)" />
    <g fill="none" stroke="var(--month-ink)" strokeWidth="2.5" opacity=".6"><path d="M-84-33c24-6 43-3 64 7m-64 16c24-6 43-3 64 7m-64 16c24-6 43-3 64 7m40-46c21-10 40-13 64-7m-64 30c21-10 40-13 64-7m-64 30c21-10 40-13 64-7" /></g>
    <path d="m57-57 18-4v78l-9-9-9 12z" fill="var(--month-accent)" />
  </g>
}
function Lantern({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
    <path d="M0-145V-64" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
    <path d="m0-70 19 43 46 5-34 32 10 47L0 33l-41 24 10-47-34-32 46-5z" fill="var(--month-warm)" />
    <path d="m0-47 13 30 32 3L21 7l7 32L0 23l-28 16 7-32-24-21 32-3z" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
    <path d="m-38 55-18 75 29-32 9 44L0 34l18 108 9-44 29 32-18-75" fill="var(--month-accent)" />
  </g>
}

/** Twelve original botanical / everyday scenes. No copied or remote calendar artwork. */
function Scene({ id, side }: { id: MonthSceneId; side: 'left' | 'right' }): ReactNode {
  const right = side === 'right'
  switch (id) {
    case '01': return right ? <>
      <circle cx="325" cy="157" r="79" fill="var(--month-warm)" /><circle cx="325" cy="157" r="102" fill="none" stroke="var(--month-warm)" strokeWidth="2" />
      <path d="M43 362c76-113 154-141 264-70s155 49 214 5v207H43z" fill="var(--month-accent)" /><path d="M10 411c112-89 162-38 266-41s154-75 241-43v177H10z" fill="var(--month-ink)" opacity=".6" />
      <path d="m87 141 18-8 18 8m36 39 13-7 13 7" fill="none" stroke="var(--month-ink)" strokeWidth="3" strokeLinecap="round" />
      <Star x={151} y={80} size={12} />
    </> : <>
      <path d="M108 148c-6 62 59 51 58 106s-55 55-26 105" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
      <path d="m108 44 53 71-53 77-49-77z" fill="var(--month-accent)" /><path d="m108 44 0 148 53-77z" fill="var(--month-warm)" /><path d="m59 115 102 0m-53-71v148" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
      <path d="m122 222-18-1 7 15zm40 55-17 2 13 15z" fill="var(--month-warm)" /><Cloud x={283} y={353} scale={.8} /><Star x={252} y={175} />
    </>
    case '02': return right ? <>
      <path d="M341 500c-68-121-32-210-113-309m96 158c48-78 82-73 103-158m-127 91c-72-34-101-14-136-82" fill="none" stroke="var(--month-ink)" strokeWidth="3" strokeLinecap="round" />
      <Heart x={225} y={172} scale={1.5} rotate={-28} /><Heart x={425} y={170} scale={1.2} rotate={22} /><Heart x={158} y={186} scale={.9} rotate={-36} />
      <Leaf x={314} y={333} rotate={-17} scale={1.1} /><Heart x={362} y={88} scale={.5} /><Star x={100} y={275} size={10} />
    </> : <>
      <Heart x={130} y={285} scale={2} rotate={-16} /><Heart x={238} y={164} scale={1.2} rotate={18} />
      <path d="M130 338c-40 48 31 71-5 118m107-264c-31 52 41 61 11 109" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
      <Star x={79} y={146} /><Star x={288} y={330} size={9} /><circle cx="278" cy="92" r="5" fill="var(--month-warm)" />
    </>
    case '03': return right ? <>
      <path d="M330 481c-8-139 24-179-7-307m2 122c-62-5-80-49-88-81m97 144c64-26 84-64 86-100" fill="none" stroke="var(--month-ink)" strokeWidth="3" />
      <Leaf x={324} y={221} rotate={-7} scale={1.2} /><Leaf x={332} y={278} rotate={101} scale={1.3} /><Leaf x={315} y={371} rotate={-21} scale={1.55} /><Leaf x={326} y={425} rotate={108} scale={1.5} />
      <circle cx="202" cy="124" r="36" fill="var(--month-warm)" /><path d="M161 451h262m-232 21h181" stroke="var(--month-ink)" strokeWidth="2" strokeLinecap="round" />
    </> : <>
      <path d="M81 429c58-9 81-13 138-4s79 11 112 0" fill="none" stroke="var(--month-ink)" strokeWidth="3" />
      <path d="M171 421V263" stroke="var(--month-ink)" strokeWidth="3" /><Leaf x={171} y={331} rotate={-18} scale={1.1} /><Leaf x={171} y={288} rotate={100} scale={1.1} />
      <path d="M274 425v-70" stroke="var(--month-ink)" strokeWidth="2" /><Leaf x={274} y={383} rotate={2} scale={.65} /><Leaf x={274} y={361} rotate={115} scale={.6} />
      <circle cx="100" cy="230" r="5" fill="var(--month-warm)" /><Star x={257} y={174} size={12} />
    </>
    case '04': return right ? <>
      <path d="M318 510c-11-124 9-167-33-277m34 181c64-64 58-118 90-173" fill="none" stroke="var(--month-ink)" strokeWidth="3" />
      <Flower x={279} y={211} scale={1.25} rotate={12} /><Flower x={412} y={220} scale={.83} rotate={-14} /><Flower x={357} y={99} scale={.55} />
      <Leaf x={317} y={414} rotate={-12} scale={1.15} /><Leaf x={330} y={358} rotate={105} scale={.8} /><Star x={177} y={114} size={11} />
    </> : <>
      <Flower x={137} y={335} scale={1.6} rotate={-14} /><Flower x={250} y={251} scale={.7} rotate={18} />
      <path d="M136 420v-17m-57-66H61m66-65-3-18m78 99 17 9" stroke="var(--month-ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M154 159c-41-39-62-12-28 10-47 9-31 44 6 20 14 41 46 22 18-10 44-15 17-48 4-20" fill="var(--month-warm)" /><path d="m132 178 17-18" stroke="var(--month-ink)" strokeWidth="2" />
    </>
    case '05': return right ? <>
      <circle cx="345" cy="159" r="80" fill="var(--month-warm)" /><circle cx="345" cy="159" r="103" fill="none" stroke="var(--month-warm)" strokeWidth="2" />
      <path d="M287 500c48-103 47-175 21-239" fill="none" stroke="var(--month-ink)" strokeWidth="13" strokeLinecap="round" />
      <path d="M308 263c-1-76 57-97 97-57-48-8-75 18-97 57m0 0c50-57 115-14 105 37-26-43-66-47-105-37m0 0c-48-66-107-36-109 11 33-31 63-29 109-11m0 0c-48-5-74 37-58 72 8-39 26-56 58-72" fill="var(--month-accent)" />
      <Waves y={437} count={2} />
    </> : <>
      <path d="M-10 411c112-76 210-67 360-5v104H-10z" fill="var(--month-warm)" /><Waves y={324} />
      <path d="M120 379c-16-36-15-58 4-84m-2 46c27-8 41-4 53 10" fill="none" stroke="var(--month-ink)" strokeWidth="3" /><Leaf x={121} y={323} rotate={99} scale={.65} />
      <path d="m217 174 15-7 15 7m-70 37 11-6 11 6" fill="none" stroke="var(--month-ink)" strokeWidth="3" strokeLinecap="round" />
    </>
    case '06': return right ? <>
      <path d="M322 241v142c0 36-45 35-45 3" fill="none" stroke="var(--month-ink)" strokeWidth="5" strokeLinecap="round" />
      <path d="M193 247a129 129 0 0 1 258 0c-21-18-43-18-64 0-22-18-43-18-65 0-22-18-43-18-65 0-22-18-43-18-64 0" fill="var(--month-accent)" />
      <path d="M322 118c-42 18-62 59-65 129m65-129c41 18 62 59 65 129" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
      <g stroke="var(--month-ink)" strokeWidth="3" strokeLinecap="round"><path d="m228 75-8 19m68-45-8 19m87 4-8 19m75-2-8 19m17 218-8 19m-212-8-8 19" /></g>
      <ellipse cx="327" cy="437" rx="104" ry="12" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
    </> : <>
      <Branch x={142} y={334} rotate={-24} scale={1.15} /><Cloud x={237} y={134} scale={.8} />
      <g stroke="var(--month-ink)" strokeWidth="3" strokeLinecap="round"><path d="m214 185-8 18m43 6-8 18m-42-6-8 18m102-40-8 18m-23 23-8 18" /></g>
    </>
    case '07': return right ? <>
      <Cloud x={350} y={180} scale={1.2} /><Cloud x={173} y={338} scale={.65} /><circle cx="222" cy="106" r="46" fill="var(--month-warm)" />
      <path d="M119 298c-27-112 127-58 101 15s58 99 117 48" fill="none" stroke="var(--month-ink)" strokeWidth="2" strokeDasharray="6 9" strokeLinecap="round" />
      <path d="m331 347 103-46-46 95-15-35z" fill="var(--month-warm)" /><path d="m331 347 42 14 61-60-50 66 4 29" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
    </> : <>
      <Cloud x={136} y={337} scale={1.25} /><Cloud x={286} y={224} scale={.55} />
      <path d="m121 153 79-34-32 76-14-31z" fill="var(--month-warm)" /><path d="m121 153 33 11 46-45-39 50 7 26m-20-10c-24 74 81 53 49 122" fill="none" stroke="var(--month-ink)" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 7" />
    </>
    case '08': return right ? <>
      <circle cx="372" cy="143" r="53" fill="var(--month-warm)" /><path d="M295 139v206" stroke="var(--month-ink)" strokeWidth="3" />
      <path d="m284 161-97 152h97z" fill="var(--month-accent)" /><path d="m307 192 81 121h-81z" fill="var(--month-warm)" /><path d="m191 332 192 0-31 37H224z" fill="var(--month-ink)" />
      <Waves y={386} count={4} /><path d="m139 115 15-7 15 7" fill="none" stroke="var(--month-ink)" strokeWidth="2" strokeLinecap="round" />
    </> : <>
      <Waves y={323} count={4} /><path d="M68 300c17-46 49-74 87-89 14 35 15 64 9 89z" fill="var(--month-warm)" />
      <path d="m80 298 75-87m-50 87 50-87m-23 89 23-89" fill="none" stroke="var(--month-ink)" strokeWidth="2" opacity=".75" /><circle cx="259" cy="192" r="4" fill="var(--month-ink)" />
    </>
    case '09': return right ? <>
      <Book x={322} y={304} scale={1.1} rotate={-12} /><Branch x={396} y={126} rotate={32} scale={.55} />
      <path d="m175 123 15 3-29 131-12 16-4-20z" fill="var(--month-accent)" /><path d="m145 253 16 4-12 16z" fill="var(--month-warm)" />
      <Star x={268} y={115} /><Star x={440} y={420} size={9} /><circle cx="178" cy="391" r="5" fill="var(--month-warm)" />
    </> : <>
      <Book x={153} y={346} scale={.9} rotate={11} /><Leaf x={243} y={199} rotate={23} scale={1.05} />
      <path d="M243 199c-11 27-11 48-5 69" fill="none" stroke="var(--month-ink)" strokeWidth="2" /><Star x={88} y={175} size={11} />
    </>
    case '10': return right ? <>
      <path d="M335 506c-59-119-24-187-41-303m16 157c55-64 99-70 122-120" fill="none" stroke="var(--month-ink)" strokeWidth="3" />
      <path d="M294 237c-62-10-102-48-91-87 23 3 36 13 47 21-2-34 21-64 42-66 21 16 31 41 25 66 20-11 34-16 50-12 3 37-31 64-73 78" fill="var(--month-warm)" />
      <Leaf x={310} y={353} rotate={107} scale={1.2} /><Leaf x={318} y={431} rotate={-10} scale={1.4} />
      <circle cx="412" cy="133" r="8" fill="var(--month-accent)" /><Star x={186} y={318} size={11} />
    </> : <>
      <Leaf x={182} y={348} rotate={-18} scale={1.8} fill="var(--month-warm)" /><Leaf x={228} y={218} rotate={88} scale={1.15} />
      <path d="M182 348c-28 36-16 69 17 84m12-244c-33-50-73-3-33 21" fill="none" stroke="var(--month-ink)" strokeWidth="2" strokeLinecap="round" /><Star x={97} y={220} size={10} />
    </>
    case '11': return right ? <>
      <path d="M325 85c-65 7-104 77-67 132 35 53 105 39 125-1-80 17-110-72-58-131Z" fill="var(--month-warm)" />
      <Branch x={386} y={371} rotate={22} scale={1.05} /><Branch x={241} y={431} rotate={-32} scale={.78} />
      <Star x={416} y={149} size={13} /><Star x={177} y={177} size={9} /><circle cx="396" cy="80" r="4" fill="var(--month-ink)" /><circle cx="203" cy="300" r="4" fill="var(--month-warm)" />
    </> : <>
      <Branch x={122} y={323} rotate={-25} scale={1.2} /><Branch x={256} y={405} rotate={22} scale={.78} />
      <Star x={202} y={128} size={13} /><Star x={80} y={199} size={9} /><circle cx="304" cy="210" r="5" fill="var(--month-warm)" />
    </>
    case '12': return right ? <>
      <Lantern x={327} y={211} scale={1.25} rotate={8} /><Lantern x={146} y={142} scale={.55} rotate={-12} />
      <Star x={431} y={116} size={13} /><Star x={209} y={343} size={10} /><Star x={424} y={401} size={10} />
      <path d="M98 40c107 36 207 32 340-11" fill="none" stroke="var(--month-ink)" strokeWidth="2" />
    </> : <>
      <Lantern x={142} y={247} scale={.85} rotate={-12} /><Branch x={211} y={419} rotate={34} scale={.8} />
      <Star x={262} y={154} size={14} /><Star x={61} y={396} size={11} /><circle cx="303" cy="307" r="4" fill="var(--month-warm)" />
    </>
  }
}

export function MonthArtwork({ month, side, className = '' }: { month: string; side: 'left' | 'right'; className?: string }) {
  const scene = monthScene(month)
  return <svg className={`month-artwork ${className}`} data-month-art={scene.id} data-month-side={side} viewBox="0 0 500 500" fill="none" aria-hidden="true" focusable="false" style={monthPalette(scene)}>
    <Scene id={scene.id} side={side} />
  </svg>
}

export function MonthBackdrop({ month, view }: { month: string; view: 'timeline' | 'calendar' | 'sign-in' }) {
  const scene = monthScene(month)
  return <div className={`month-backdrop month-backdrop-${view}`} data-month-background={month} data-month-scene={scene.id} aria-hidden="true" style={monthPalette(scene)}>
    <MonthArtwork month={month} side="right" className="month-backdrop-right" />
    <MonthArtwork month={month} side="left" className="month-backdrop-left" />
  </div>
}
