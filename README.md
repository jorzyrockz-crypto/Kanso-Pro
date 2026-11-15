# Kanso Pro

A little structure. A lot of possibility.

An iPad-first, local-first workspace for events, personal tasks, project milestones, and journal reflections. A persistent, reach-friendly **bottom navigation bar** connects five workspace pages; the slim top header keeps branding, New card, and a **Profile** disclosure for account access and Settings. Every view — including card creation, account management, and Settings — has its own URL and uses normal document scrolling, not a modal overlay.

## Run locally

Requires **Node.js 22.17+ (22.x), or Node.js 24+**.

```sh
npm ci
npm run dev
```

Open the local Vite address (port **5173** by default). The development server binds to `0.0.0.0` and accepts Arena's `.e2b.app` preview hosts.

```sh
npm run build       # Strict TypeScript checks + production build
npm run preview     # Serve the production build
npm test            # Vitest dates, storage, routing, themes, and auth adapter
npm run test:e2e    # Playwright interactions, navigation, responsive layout, axe
```

The browser tests use an npm-packaged Chromium on Linux x64, so they do not need a separate browser download. Playwright 1.61.1 and Chromium 149 are pinned as a matching stable pair; update these together. Later browser builds have a [known native new-tab regression](https://github.com/microsoft/playwright/issues/42142), so the separate-tab test remains unchanged rather than hiding it with retries. On macOS, Windows, or Linux ARM, run `npx playwright install chromium` first. An existing browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Pages and navigation

| Page | URL | Card-specific example |
| --- | --- | --- |
| Timeline | `/` | Card links open the corresponding page below |
| Calendar | `/calendar` | `/calendar/evt-oquendo` |
| Tasks | `/tasks` | `/tasks/task-grades` |
| Projects | `/projects` | `/projects/proj-reading` |
| Journal | `/journal` | `/journal/note-observation` |
| New card | `/new` | `/new?type=project&date=2026-11-14` |
| Sign in | `/sign-in` | `/sign-in?mode=create` or `/sign-in?mode=reset` |
| My workspace / Account | `/account` | Signed-in profile and device workspace |
| Settings | `/settings` | `/settings#appearance` or `/settings#workspace` |

- The fixed workspace bottom bar keeps all five labeled page links within easy reach, with an active-page indicator and navigation touch targets at least 44 × 44 CSS pixels. The top header no longer duplicates the page links.
- Bottom and side safe-area insets are respected. Measured bar height reserves space for the last content, footer, keyboard focus scrolling, and toast messages so they do not disappear behind navigation.
- Page URLs support direct visits, refresh, browser Back/Forward, and opening links in a new tab. `/timeline` redirects to `/`.
- Calendar selection is reflected in `?month=2026-12` or `?date=2026-11-11`; individual task lists, projects, and journal entries use card-specific paths.
- The app retains shared state while switching pages, restores scroll on Back/Forward, updates browser titles, and focuses page content for keyboard/screen-reader navigation.
- Unknown paths and missing/wrong-type cards have recovery pages rather than silently opening a different item.
- The header’s **Profile menu** (avatar/name button) opens account navigation and **Settings**. Guests get Sign in and Create account; signed-in users get Profile & account and a separate Sign out action. It supports touch, Enter/Space, normal Tab order, Escape, and outside dismissal. The dedicated sign-in screen keeps its quiet brand/back header, without a redundant Profile menu, planning tabs, or New card. Old signed-out `/account?mode=…` links are replaced with their `/sign-in` equivalent.
- **New card** opens a creation page with contextual defaults. Cancel returns to the originating page; successfully creating a card returns to and highlights it on the timeline.

## Included

- Ice-blue gradients, glass surfaces, self-hosted Plus Jakarta Sans and Newsreader fonts, and a responsive portrait timeline based on the supplied design reference.
- A glowing, scroll-responsive center spine and alternating cards on iPad/desktop; a single-column, left-spine layout below 681px.
- Type filters, date nodes, four customizable special-occasion vector backgrounds, lined journal paper, and an optional tablet frame.
- Twelve subtle monthly vector backdrops for Timeline, Calendar, and the dedicated sign-in screen, with a matching illustrated calendar header and seasonal welcome panel.
- **Per-card filters**, including days that contain multiple card types. Filter and quiet-buffer state survive page changes.
- Expandable quiet-day buffers. New cards appear in real date order and split buffers when needed. Returning to a quiet reflection from its page reveals it automatically.
- A real Monday-first monthly calendar, month navigation, selected-day agenda, and card-specific links.
- Two-way task checklist synchronization, selected-list management, and new actions attached to their task card.
- Independent project milestone checklists, accurate completion percentages, and pending/in-progress/completed states.
- Live journal title/body editing, word counts, and a selector for individual reflections.
- A validated four-type creation form with real dates, project due dates, context, checklists, and note text.
- Reload persistence, same-browser cross-tab updates, schema validation, and a warning when device storage is unavailable.
- Firebase email/password account creation and sign-in, optional Google sign-in, profile name editing, verification, password recovery, and sign-out without changing local cards.
- Guest access, clear sign-in loading/error states, and a JSON device-workspace export with no account credentials.
- A dedicated **Profile → Settings** page for account access, the shared Tablet frame preference, workspace counts/backups, privacy/storage guidance, version, and help. Settings works without sign-in or a working Firebase connection.
- Keyboard-operable navigation, a skip link, one main landmark per page, reduced-motion support, and literal-text rendering through React. No HTML injection or modal focus traps.

## Account access with Firebase

Choose **Profile menu → Sign in** in the header to open the dedicated **`/sign-in`** page. **Create account** in that menu opens registration directly; Settings also provides both links for guests. The sign-in page has a responsive seasonal welcome panel, a clear sign-in card, signup and recovery links, and a **Continue as guest** option. There is no modal, duplicate workspace toolbar, or fixed bottom bar on this entry screen. Device counts and JSON export remain accessible in the collapsed **Your device workspace & backup** section.

After sign-in, `/account` shows profile details, verification, password reset, and sign-out, with the normal five-destination workspace navigation. Signed-in users see their name/initials in the header; **Profile menu → Profile & account** opens this page. A signed-in visit to `/sign-in` returns to `/account`; a signed-out visit to an older `/account` URL goes to the appropriate sign-in mode. These use replacement navigation, not an extra Back-history step.

The supplied **`russapps-kanso-pro`** Firebase web configuration is included; optional `VITE_FIREBASE_*` overrides are listed in `.env.example`. **The project owner must still enable Email/Password in Firebase Authentication.** For the optional Google button, enable Google as well and authorize the exact trusted preview/production hostnames in Authentication settings. A web API key alone cannot configure or verify those settings. See [Firebase Console setup and verification](docs/firebase-setup.md) for the complete steps, browser-popup restrictions, and a manual checklist.

**Sign-in is not cloud sync or a lock on device cards.** Existing plans remain in this browser and are not uploaded, deleted, hidden, or separated by account. Everyone using the same browser profile can still access them while signed out. The page makes this explicit and offers **Export device backup** (JSON export only; no import UI yet). Firebase manages identity/session storage separately. Analytics is not initialized.

Automated authentication tests use mocked SDK boundaries and intercepted Firebase REST responses; they do not create real users, send emails, or verify live Console settings. Guest planning remains available when authentication is offline or misconfigured.

## A sign-in page that follows the month

The sign-in, account-creation, and password-recovery screens reuse the **same twelve local monthly scenes** listed below. The page wash, background vectors, featured illustration, month/year label, and seasonal title all follow the **real current month on the device**. They are not tied to the November 2026 sample, a Calendar selection, or a `month` URL parameter.

- An open page checks again just after **local midnight**, so a month/year change does not require a reload. It also refreshes on tab focus, page restoration, and return to a visible tab after suspension or a device-clock/timezone change.
- Scheduling uses the next local date, handles daylight-saving days, and avoids month-long browser timeouts. No server cron job, location permission, API request, or saved appearance preference is needed.
- Changing scenes does not reset entered form fields, passwords, feedback, or workspace cards. Artwork stays static and decorative; white form surfaces preserve contrast, touch targets stay at least 44 pixels, and narrower/keyboard-height windows use normal page scrolling.
- Tablet/desktop use a spacious side-by-side composition; phones get a compact seasonal heading above the form. Decorative artwork is hidden for higher-contrast/forced-color displays and printing, with no animation or parallax.

## Monthly view backgrounds

**Timeline, Calendar, and sign-in** share twelve original SVG scenes; the view backgrounds use low-opacity artwork on softly tinted backgrounds. The background artwork stays behind the content; all scenes are static, decorative, non-interactive, and use no remote assets or calendar connection.

| Month | Scene | Motifs |
| --- | --- | --- |
| January | Fresh horizons | Sunrise, layered hills, and a kite |
| February | Little connections | Heart-shaped leaves and paper hearts |
| March | Room to grow | Sprouts and leafy stems |
| April | In bloom | Flowers and a butterfly |
| May | Sunlit days | Sunshine, palms, and shorelines |
| June | Rain garden | An umbrella, raindrops, and foliage |
| July | Drifting clouds | Clouds and paper planes |
| August | Quiet shores | A sailboat, shells, and waves |
| September | New chapters | Open books, a pencil, and bookmarks |
| October | Golden pause | Warm-toned leaves and branches |
| November | Still moments | A crescent moon and a quiet canopy |
| December | Small wonders | Star lanterns and little twinkles |

- **Sign-in:** uses the device’s current local month automatically, including registration and password recovery. The signed-in profile page keeps its usual workspace styling.
- **Calendar:** the backdrop and header illustration follow the month shown by the calendar, including day queries, event-specific links, year changes, refresh, and Back/Forward. Use the existing previous/next month arrows to browse the artwork, even in empty months.
- **Timeline:** the month badge and backdrop follow the dated cards at the center of the reading area as you scroll. The first month is shown at the top and the last at the end; filtered and empty timelines have safe fallbacks. Month boundaries already have labeled dividers.
- Monthly scenes are **separate from event occasion backgrounds**. An April birthday can have an April page backdrop and a Birthday event card; changing one does not overwrite the other or alter event metadata.
- Cards, calendar cells, and controls keep their readable surfaces. Background illustrations never take keyboard focus or block touch, and are hidden for higher-contrast/forced-color displays and printing. There is no background animation or parallax.
- Monthly appearance is derived from the view; no new stored preference or schema migration is required. Tasks, Projects, Journal, New card, and not-found recovery pages keep their existing backgrounds.

## Special-occasion backgrounds

Events can use four original, self-contained **vector illustrations**:

- **Birthday** — cake, balloons, and bunting.
- **Celebration** — a star, ribbons, and confetti.
- **Holiday** — a sunlit shore, waves, and a palm.
- **Remembrance** — a candle and quiet leaves.

On **New card → Event**, the **Occasion background** picker shows a live preview. **Automatic** suggests a theme from the title (for example, “Mia’s birthday,” “Graduation,” or “All Souls’ Day”); ordinary meetings stay unillustrated. Choose any theme yourself, or **No illustration** to turn the artwork off. A manual choice always wins over title detection.

For an existing event, open it in **Calendar** and expand its **Background** row. Changes apply immediately to the calendar and timeline and are saved with that event on this browser. There is no modal or separate Save step. Choosing an illustration does not change an event’s dates, ownership, or actual holiday status.

The artwork is local SVG, not copied Google Calendar imagery and not an external calendar integration. It scales without image downloads; decorative SVGs stay out of the accessibility tree, and screen-relative dark overlays protect text contrast on narrow layouts. Background tiles and the inline expander have touch targets at least 44 × 44 CSS pixels. Existing version-one saves without an occasion field keep their data and default to automatic detection.

## iPad design

This is an **iPad-inspired responsive web app**, not a native iPadOS app or a claim of full Apple Human Interface Guidelines compliance. Glass surfaces, rounded cards, a portrait-first timeline, responsive landscape/split-width layouts, and a floating bottom bar are intentional design choices. Bottom navigation prioritizes reachability rather than reproducing a particular iPadOS release's navigation placement.

Navigation links and the top-level New card/home controls have touch targets at least 44 × 44 CSS pixels. The layout supports reduced motion, keyboard navigation, and safe-area spacing. Automated browser tests cover phone/tablet/desktop sizes and simulated touch and safe-area insets; they do not replace testing in Safari on a physical iPad, including its on-screen keyboard and browser chrome.

## Data and scope

The initial eight cards reproduce the **November 2026 sample journey**. Six cards are on the main stream; two live inside the November 3–9 quiet buffer. `FOCUS_DATE` in `src/data.ts` is deliberately set to **2026-11-14** to keep the supplied example consistent. “Focus Active” finds the project due on that date rather than the old meeting.

This is a **local-first workspace with Firebase Authentication**, not a cloud-synced planning service. “Live Flow” means the pages share live card state on this device. Authentication stores account identity/session information in Firebase; it does not synchronize workspace content. There is no external calendar import, remote team collaboration, background notification service, or Google Sheets synchronization. Seeded calendar source descriptions and team names are sample planning metadata. Reminder times are labels, not device alarms.

Changes are stored in `localStorage` under `kanso-pro:journey:v1`. Existing data under `chronos-flow:journey:v1` is read automatically when there is no valid Kanso Pro save, so the rebrand preserves earlier edits and preferences. The old key is left untouched. A valid Kanso Pro save takes precedence on subsequent visits.

Data remains in the current browser profile and site origin; it is not encrypted or synchronized across devices. Deploying the app does not add cloud storage or copy preview data to the production domain. Clearing site data resets the sample. Avoid storing sensitive information in a shared browser profile; signing out does not hide or partition these local cards.

## Structure

```text
src/
  App.tsx                   Shared shell, routes, timeline state, creation actions
  main.tsx                  Browser router, fonts, and React entry point
  types.ts                  Discriminated card and action types
  data.ts                   Sample journey and storage keys
  styles.css                Timeline, card, and workspace component styling
  layout.css                App header, bottom bar, full-page/responsive layouts
  occasions.css             Illustrated event surfaces, text scrims, theme picker
  months.css                Subtle month backdrops and calendar hero watermarks
  account.css               Account forms, identity, and shared device summary
  sign-in.css               Dedicated entry layout and responsive seasonal welcome
  settings.css              Profile disclosure, Settings sections/index, accessible switch
  components/
    AppHeader.tsx           Branding, New card, and the Profile disclosure
    ProfileMenu.tsx         Account-aware navigation, dismissal, focus, and sign-out
    SettingsPage.tsx        Device preferences, backup, privacy, version, and help
    DeviceWorkspace.tsx     Shared live counts/save status and account/entry backup panel
    AccountPage.tsx         Profile, auth feedback, legacy URL handling, local backup
    SignInPage.tsx          Branded entry header, login/signup/recovery forms, monthly art
    BottomNavigation.tsx    Reach-friendly active page links and safe-area bar
    PageHeader.tsx          Page headings, recovery pages, footer
    RouteEffects.tsx        Browser titles, focus, scroll restoration
    Timeline.tsx            Day groups, individual cards, quiet buffers
    Workspaces.tsx          Calendar, tasks, projects, journal pages
    Composer.tsx            New-card form and validation feedback
    EventThemePicker.tsx    Automatic/manual background selection and preview
    OccasionArtwork.tsx     Original, accessible decorative SVG scenes
    MonthArtwork.tsx        Twelve local monthly scenes and page-wide backdrops
    Common.tsx              Avatars, progress, common controls
  lib/
    account.ts              Validated auth inputs, safe identity/error presentation
    firebase.ts             Modular Firebase Auth adapter and public web config
    useAccount.ts           Shared auth observer, loading state, action protection
    navigation.ts           Page paths, Settings anchors, deep links, creation options
    workspaceBackup.ts      Workspace-only JSON, dated downloads, object-URL cleanup
    journey.ts              Timezone-safe dates, grouping, progress, creation
    occasions.ts            Theme choices, title suggestions, manual overrides
    months.ts               Month palettes, shared calendar period, reading position
    currentMonth.ts         Real device-local month and next-midnight scheduling
    useCurrentMonth.ts      Month refresh on midnight, focus, visibility, page restoration
    store.ts                Shared reducer, validated persistence, legacy migration
    useChromeHeight.ts      Measured header/bar heights for layout and scroll insets
    *.test.ts               Unit tests
tests/journey.spec.ts        Browser, routing, and accessibility regression tests
tests/navigation.spec.ts     Bottom-bar placement, touch, safe areas, and clearance
tests/occasions.spec.ts      Background creation/editing, sync, layout, keyboard, axe
tests/months.spec.ts         Twelve scenes, month/scroll/history sync, layout, contrast
tests/account.spec.ts        Auth flows, persistence, privacy, backup, layout, axe
tests/sign-in.spec.ts        All monthly scenes, clock/timezones, live rollover, responsive/axe
tests/settings.spec.ts       Profile/Settings links, focus/touch, auth/storage faults, backup, axe
tests/helpers/firebase.ts    Test-only REST interception; no production auth bypass
docs/firebase-setup.md       Provider/domain setup, data boundary, manual verification
docs/settings-plan.md        Implemented Settings specification and acceptance results
```

## Settings through Profile

Open the header’s **Profile menu → Settings**, or visit **`/settings`** directly. Settings is a normal full page, not a modal or a sixth bottom destination. Its section index is beside the content on larger screens and wraps above it on phones; each section has a shareable anchor:

- **Profile & account** (`#account`): identity/status and a link to the existing account/security page, or sign-in/create links for guests. No duplicate authentication forms.
- **Appearance** (`#appearance`): **Tablet frame**, using exactly the same saved preference as the Timeline toolbar. Changes apply immediately, survive reload, and synchronize across same-origin tabs. A decorative preview explains automatic artwork and follows the actual device-local month; it does not add a fixed-month or theme setting.
- **Device workspace & backup** (`#workspace`): live card counts, storage status, and JSON export for guests and signed-in users. A download contains workspace data only and is not cloud sync or a verified off-device backup. Download errors leave the workspace unchanged.
- **Privacy & storage** (`#privacy`): browser-profile/origin scope, shared-device access, blocked-storage/session-only behavior, and the separate account session. Another device or host has its own workspace.
- **About & help** (`#about`): the version from `package.json`, a brief usage guide, and real source/setup documentation links. Build-time source links follow the current Git branch (or Vercel’s commit-ref metadata), with `main` as the archive fallback.

The page stays usable when authentication or device persistence is unavailable. The version-one journey schema and storage key are unchanged; no identity is added to cards or exports. The sign-in page’s existing guest backup remains available too. Restore/import/reset, dark/system themes, cloud sync, and integrations are deliberately **not** included.

The [implemented Settings specification](docs/settings-plan.md) records the reference review, interaction contract, acceptance checks, and verification scope.

## Deploy to Vercel later

The app builds to a static `dist/` directory. `vercel.json` supplies Vite build settings and an SPA fallback to `index.html`, so refreshing a URL such as `/projects/proj-reading` loads the app instead of a hosting 404. Vercel serves existing static assets before the fallback.

Guest/local planning requires no backend. Account access uses the supplied Firebase project and requires its Authentication provider/domain setup; no environment variables are required unless overriding the default web configuration. Authorize the exact production hostname for Google sign-in when it is assigned. Other static hosts can also publish `dist/`, but must rewrite non-file page requests (including `/sign-in`, `/account`, and `/settings`) to `index.html`. There is no deployment included in this repository change.
