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
    {theme === 'school' && <>
      <path d="M367 237h253" stroke="#b9d9ed" strokeWidth="7" strokeLinecap="round" opacity=".75" />
      <path d="m405 156 104-72 104 72z" fill="#b9e2f5" /><path d="M422 157h174v78H422z" fill="#e8f5fb" />
      <path d="M447 178h20v47h-20zm48 0h20v47h-20zm48 0h20v47h-20zm48 0h20v47h-20z" fill="#77afd1" />
      <path d="M501 225h18v-37h-18z" fill="#315f83" /><path d="M508 73v22" stroke="#f4cf79" strokeWidth="5" strokeLinecap="round" /><path d="M494 72h28" stroke="#f4cf79" strokeWidth="4" strokeLinecap="round" />
      <path d="M573 99c0-15 22-15 22 0v10c0 12-22 12-22 0z" fill="#f8c979" /><path d="M584 121v17" stroke="#f8c979" strokeWidth="3" strokeLinecap="round" />
      <path d="M378 205c25-29 53-25 73-3-24 19-49 20-73 3z" fill="#76b49a" /><path d="M392 198c7-20 16-28 27-32" fill="none" stroke="#9fd1ae" strokeWidth="6" strokeLinecap="round" />
      <circle cx="606" cy="61" r="4" fill="#f7d591" /><circle cx="383" cy="93" r="3" fill="#b9e5f2" />
    </>}
    {theme === 'learning' && <>
      <ellipse cx="510" cy="247" rx="109" ry="11" fill="#17214c" opacity=".3" />
      <path d="M411 171c36-21 69-18 99 7v59c-30-25-63-28-99-7z" fill="#e2eaff" /><path d="M510 178c30-25 63-28 99-7v59c-36-21-69-18-99 7z" fill="#cad9f4" />
      <path d="M510 181v54" stroke="#94aad3" strokeWidth="4" /><path d="M430 190c22-10 43-7 63 7m-63 13c22-10 43-7 63 7m37-20c20-14 41-17 62-7m-62 27c20-14 41-17 62-7" fill="none" stroke="#8ea4d0" strokeWidth="3" strokeLinecap="round" />
      <path d="M512 77c-20 27-18 48 0 63 18-15 20-36 0-63" fill="#f8d377" /><path d="M512 93c-8 15-7 27 0 34 7-7 8-19 0-34" fill="#fff3bc" />
      <path d="m512 140-11 22h22z" fill="#f3c46b" /><path d="M463 104v16m-8-8h16m108-12v15m-7-7h14" stroke="#d5dbff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="599" cy="73" r="4" fill="#f3b6ba" /><circle cx="421" cy="120" r="3" fill="#a9dce4" />
    </>}
    {theme === 'wellbeing' && <>
      <ellipse cx="520" cy="244" rx="91" ry="11" fill="#10463f" opacity=".28" />
      <path d="M514 219c-68-52-85-96-51-119 23-16 43 2 51 21 8-19 28-37 51-21 34 23 17 67-51 119z" fill="#f2a8a1" />
      <path d="M514 203c-42-37-54-69-33-85 15-11 28 4 33 17 5-13 18-28 33-17 21 16 9 48-33 85z" fill="#ffe5d6" />
      <path d="M514 78v17m-8-8h16m65 70v20m-10-10h20" stroke="#c8f0d5" strokeWidth="5" strokeLinecap="round" />
      <path d="M428 209c25-42 63-37 82-14-32 5-59 11-82 14z" fill="#82c98d" /><path d="M531 195c24-37 60-33 77-10-31 5-54 8-77 10z" fill="#68b985" />
      <path d="M451 219c9-34 24-51 46-64m79 60c-10-31-22-49-42-63" fill="none" stroke="#b7e2a6" strokeWidth="4" strokeLinecap="round" />
      <circle cx="420" cy="111" r="4" fill="#f4d283" /><circle cx="602" cy="111" r="3" fill="#c8f0d5" />
    </>}
    {theme === 'community' && <>
      <ellipse cx="516" cy="243" rx="106" ry="11" fill="#4f1e2b" opacity=".3" />
      <circle cx="512" cy="129" r="42" fill="#f5cc83" opacity=".35" /><path d="M512 101c20 0 36 14 36 32s-16 32-36 32-36-14-36-32 16-32 36-32z" fill="#f5c577" />
      <path d="M433 191c17-35 50-48 78-26-15 29-40 46-78 26zm157 0c-17-35-50-48-78-26 15 29 40 46 78 26z" fill="#f3b2a6" />
      <path d="M448 195c19 18 41 25 64 18m64-18c-19 18-41 25-64 18" fill="none" stroke="#ffd9cf" strokeWidth="6" strokeLinecap="round" />
      <path d="M473 96c-15-20-37-20-52-2m147 2c15-20 37-20 52-2" fill="none" stroke="#ecc9ad" strokeWidth="7" strokeLinecap="round" />
      <circle cx="426" cy="89" r="12" fill="#c98f78" /><circle cx="600" cy="89" r="12" fill="#d6a587" />
      <path d="M510 77v15m-7-7h14m-106 68v13m-6-6h12m186-7v13m-6-6h12" stroke="#f8d49f" strokeWidth="3" strokeLinecap="round" />
    </>}
    {theme === 'environment' && <>
      <circle cx="567" cy="86" r="36" fill="#f6d786" /><path d="M353 220c63-35 121 16 187-3s91-10 100-15v78H353z" fill="#4a9b74" />
      <path d="M353 238c58-23 110 14 170-2s83-16 117-8v52H353z" fill="#81c38a" />
      <path d="M511 213V112" stroke="#8d6040" strokeWidth="12" strokeLinecap="round" />
      <path d="M511 144c-39-29-74-18-78 9 33-10 56-9 78-9zm0 23c-45 0-62 25-52 50 22-24 36-38 52-50zm0-30c34-35 70-25 77 2-34-6-57-3-77-2zm0 34c43-5 63 17 57 44-20-21-36-34-57-44z" fill="#a3d78a" />
      <path d="M389 197c34-15 58-13 85 3m85-3c26-16 51-17 72-5" fill="none" stroke="#d9f0ca" strokeWidth="3" strokeLinecap="round" />
      <path d="M588 82v15m-8-7h16m-173 22v14m-7-7h14" stroke="#fff1b8" strokeWidth="3" strokeLinecap="round" />
    </>}
    {theme === 'culture' && <>
      <path d="M389 76c40 27 75 27 112 0m21 0c37 27 72 27 111 0" fill="none" stroke="#e9a68f" strokeWidth="5" strokeLinecap="round" />
      <path d="M399 106h224v18H399zm0 36h224v18H399zm0 36h224v18H399z" fill="#cf7a79" opacity=".5" />
      <path d="M416 106v18m24-18v18m24-18v18m24-18v18m24-18v18m24-18v18m24-18v18m24-18v18m24-18v18" stroke="#f5d8a8" strokeWidth="5" />
      <path d="M446 228c33-51 43-77 43-106v-15" fill="none" stroke="#f7d38b" strokeWidth="7" strokeLinecap="round" /><path d="M489 107h50" stroke="#f7d38b" strokeWidth="7" strokeLinecap="round" />
      <path d="M540 130v58c0 13 22 13 22 0 0-12-22-11-22 0" fill="#b7d8e1" /><path d="M562 131h35v29c-14-7-24-5-35 1z" fill="#b7d8e1" />
      <path d="M400 224h220" stroke="#e8bb92" strokeWidth="7" strokeLinecap="round" /><circle cx="600" cy="83" r="4" fill="#f5d8a8" /><circle cx="425" cy="74" r="3" fill="#b7d8e1" />
    </>}
    {theme === 'sports' && <>
      <ellipse cx="514" cy="245" rx="103" ry="10" fill="#102d59" opacity=".35" />
      <circle cx="561" cy="172" r="38" fill="#f3c568" /><path d="M530 157c23-13 39-4 54 11m-53 30c14-19 38-18 58-4m-28-59c4 21 1 45-8 72" fill="none" stroke="#2d6093" strokeWidth="4" strokeLinecap="round" />
      <circle cx="461" cy="94" r="17" fill="#f2b59b" /><path d="M462 112c8 26 23 40 47 50l-23 45m23-45 44 16 31 38" fill="none" stroke="#d7e9ef" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m500 202-42 31m80-38 23 37" fill="none" stroke="#93cfe1" strokeWidth="12" strokeLinecap="round" /><path d="M446 80c12-14 25-14 34-3" fill="none" stroke="#f3c568" strokeWidth="7" strokeLinecap="round" />
      <path d="M394 195c20-30 39-43 62-47m110-38 12 11m-1-20 14 5" fill="none" stroke="#b8e3f0" strokeWidth="4" strokeLinecap="round" />
      <path d="M398 230h219" stroke="#9dd6e4" strokeWidth="6" strokeLinecap="round" />
    </>}
  </svg>
}
