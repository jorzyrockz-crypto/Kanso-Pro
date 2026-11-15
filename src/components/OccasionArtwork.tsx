import { useId } from 'react'
import type { OccasionTheme } from '../types'
import { OCCASION_THEMES } from '../lib/occasions'

/** Original, local SVG artwork. Decorative only; no remote images, scripts, or user SVG. */
export function OccasionArtwork({ theme, miniature = false }: { theme: OccasionTheme; miniature?: boolean }) {
  const id = useId().replace(/:/g, '')
  const colors = OCCASION_THEMES[theme]
  return <svg className="occasion-artwork" data-occasion-art={theme} viewBox={miniature ? '330 0 310 280' : '0 0 640 280'}
    preserveAspectRatio={miniature ? 'xMidYMid slice' : 'xMaxYMid slice'} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2=".75"><stop stopColor={colors.start} /><stop offset="1" stopColor={colors.end} /></linearGradient>
      <radialGradient id={`${id}-halo`}><stop stopColor={theme === 'remembrance' ? '#ffdc98' : '#fff2d6'} stopOpacity=".24" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
    </defs>
    <path fill={`url(#${id}-base)`} d="M0 0h640v280H0z" />
    <circle cx="510" cy="130" r="170" fill={`url(#${id}-halo)`} />
    {theme === 'birthday' && <>
      <path d="M335 0c58 68 191 84 305 19" fill="none" stroke="#f7c4c4" strokeWidth="2" opacity=".55" />
      <path d="m391 40 17 3-12 19zm51 13 18 1-9 19zm54 0 18-2-5 20zm53-10 17-5 1 21zm49-18 16-9 5 20z" fill="#ffd28b" />
      <ellipse cx="505" cy="244" rx="104" ry="12" fill="#451b3e" opacity=".35" />
      <path d="M545 97c-27 37 7 67-19 92m64-109c-4 40-39 64-38 117" fill="none" stroke="#f7dbe4" strokeWidth="2" opacity=".75" />
      <ellipse cx="549" cy="74" rx="28" ry="37" fill="#f69ba8" transform="rotate(-15 549 74)" />
      <path d="m542 108-1 8 9-3" fill="#f69ba8" /><path d="M537 55c-8 9-8 19-5 25" fill="none" stroke="#ffdce0" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="599" cy="55" rx="24" ry="33" fill="#9bd5e2" transform="rotate(15 599 55)" />
      <path d="m593 84-5 8 10-1" fill="#9bd5e2" /><path d="M591 35c-6 5-8 12-7 18" fill="none" stroke="#e4fbff" strokeWidth="3" strokeLinecap="round" />
      <path d="M435 170h112v57c0 8-112 8-112 0z" fill="#f9be9a" /><ellipse cx="491" cy="170" rx="56" ry="12" fill="#fff2d9" />
      <path d="M435 171c0 7 10 8 13 11s1 13 8 13 5-10 13-8 4 16 13 15 5-16 14-15 5 13 14 12 4-16 13-17 20-2 24-11" fill="#fff2d9" />
      <path d="M435 215c28 9 83 9 112 0v12c0 11-112 11-112 0z" fill="#ea8c9d" />
      <rect x="486" y="135" width="10" height="32" rx="3" fill="#91d0d7" /><path d="m487 140 8 5m-8 6 8 5" stroke="#e7fbf3" strokeWidth="3" />
      <path d="M491 111c-14 16-10 23 0 23s13-8 0-23" fill="#ffcf76" /><path d="M491 122c-5 7-4 10 0 10s4-3 0-10" fill="#fff7d5" />
      <path d="M418 230h147" stroke="#e7b6ce" strokeWidth="7" strokeLinecap="round" />
      <path d="m395 114 5 9m185 91 6-9m-184-9-8 2m169-65 5 4" stroke="#ffd98f" strokeWidth="4" strokeLinecap="round" />
      <circle cx="418" cy="145" r="3" fill="#b8e5e5" /><circle cx="578" cy="173" r="4" fill="#f7c4d2" />
    </>}
    {theme === 'celebration' && <>
      <path d="M360 0c48 57 173 65 280 22" fill="none" stroke="#baafe7" strokeWidth="2" />
      <path d="m398 30 19 6-15 18zm50 12 20 2-11 21zm53 0 19-3-5 23zm50-10 18-6 0 22zm47-17 17-9 5 22z" fill="#f7c68e" />
      <circle cx="517" cy="147" r="75" fill="#9986d1" opacity=".15" /><circle cx="517" cy="147" r="54" fill="#bba9ed" opacity=".12" />
      <path d="m511 85 18 37 42 6-30 29 7 42-37-20-37 20 7-42-30-29 42-6z" fill="#ffda94" />
      <path d="m511 107 12 25 28 4-20 19 4 28-24-13-24 13 5-28-20-19 27-4z" fill="#ffe9bc" />
      <path d="m482 187-12 69 30-18 14 24 11-75" fill="#ee9aac" /><path d="m522 188 15 59 15-25 28 12-30-58" fill="#a8d7e1" />
      <path d="M430 82v14m-7-7h14m153 61v14m-7-7h14M581 76v13m-6-6h12" stroke="#e6d3f6" strokeWidth="3" strokeLinecap="round" />
      <path d="m406 168-11 10m48 33-5 12m154-13 12 6m-50-171 5 8" stroke="#f5b888" strokeWidth="4" strokeLinecap="round" />
      <path d="M578 109c15-16 6-27 21-33m-178 78c16-3 12-14 23-13m137 117c9-17 21-4 27-19" fill="none" stroke="#b8dfe6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="450" cy="59" r="3" fill="#f3b8d4" /><circle cx="606" cy="122" r="3" fill="#ffdc9b" /><circle cx="419" cy="235" r="4" fill="#c6b6ed" />
    </>}
    {theme === 'holiday' && <>
      <circle cx="541" cy="102" r="42" fill="#ffda9b" /><circle cx="541" cy="102" r="57" fill="none" stroke="#ffda9b" strokeWidth="1.5" opacity=".2" />
      <path d="M302 207c81-40 144 24 216-4s107-4 122-6v83H302z" fill="#58a4a0" />
      <path d="M320 232c66-35 124 11 188-6s97-16 132-5v59H320z" fill="#84c2b3" />
      <path d="M410 258c80-52 149-51 230-38v60H410z" fill="#f1d8ad" />
      <path d="M474 231c14-43 9-75-5-110" fill="none" stroke="#dfbd8c" strokeWidth="11" strokeLinecap="round" />
      <path d="M471 120c-5-45 31-66 62-51-29 2-43 21-62 51" fill="#a6cfac" />
      <path d="M471 121c18-42 59-35 74-9-25-8-49-6-74 9" fill="#b9dcb5" />
      <path d="M471 120c40-10 61 17 59 47-17-22-38-36-59-47" fill="#85baa2" />
      <path d="M471 120c-29-34-61-14-68 13 27-15 47-18 68-13" fill="#7fb49d" />
      <path d="M470 120c-36 3-45 29-39 54 7-28 20-42 39-54" fill="#91c4a7" />
      <path d="M379 191h30m158-16h27m-218 52h34m171 15h22" stroke="#d3ece0" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
      <path d="m585 68 8-5 8 5m-212 34 9-5 9 5" fill="none" stroke="#c1dfd9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M556 246h21m-10-10v20" stroke="#dbae79" strokeWidth="3" strokeLinecap="round" />
    </>}
    {theme === 'remembrance' && <>
      <ellipse cx="519" cy="249" rx="80" ry="9" fill="#0f2839" opacity=".4" />
      <path d="M445 247c22-32 15-72-14-99m135 96c-9-42 2-73 38-105" fill="none" stroke="#a1bfa8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M444 218c-25 2-40-15-37-31 18 1 32 13 37 31m8-20c-8-17-4-38 12-43 6 20 1 35-12 43m-6-21c-25-4-32-20-27-34 17 4 27 16 27 34" fill="#91b49d" />
      <path d="M575 209c18-1 35-12 35-30-21-1-35 12-35 30m6-26c-14-15-14-32-3-42 13 13 15 30 3 42m12-25c21 0 32-14 28-28-18 3-27 12-28 28" fill="#b2c4a5" />
      <rect x="485" y="145" width="63" height="96" rx="7" fill="#f2e5c7" />
      <path d="M485 149c8-5 15 6 24 1s17-8 26-3 13 2 13 2v18c-6 4-9-4-14-1s-2 14-8 14-4-13-10-15-8 8-13 4-9-3-18-2z" fill="#fff3db" />
      <path d="M536 153v80" stroke="#d8c5a4" strokeWidth="6" strokeLinecap="round" opacity=".6" />
      <path d="M516 145v-12" stroke="#624d34" strokeWidth="3" strokeLinecap="round" />
      <path d="M517 84c-7 22-26 26-20 43 7 21 43 5 34-15-5-11-13-13-14-28" fill="#f8c674" />
      <path d="M516 105c-1 10-11 13-9 22 2 9 18 7 19-2 0-8-9-12-10-20" fill="#fff1bd" />
      <path d="M478 243h77" stroke="#b7b79c" strokeWidth="6" strokeLinecap="round" />
      <circle cx="473" cy="74" r="2" fill="#e6d2a9" /><circle cx="564" cy="89" r="2" fill="#ebdbb9" /><circle cx="599" cy="51" r="2" fill="#c2d3bb" />
      <path d="M417 85v10m-5-5h10m156 22v8m-4-4h8" stroke="#dbd8b9" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
    </>}
  </svg>
}
