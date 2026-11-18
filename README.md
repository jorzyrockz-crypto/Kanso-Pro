# Kanso Pro

A little structure. A lot of possibility.

An iPad-first, local-first workspace for events, personal tasks, project milestones, and journal reflections. An adaptive five-destination navigation stays at the **bottom on phones/portrait tablets** and becomes a **sidebar on laptops and larger landscape tablets**; the slim top header keeps branding, New card, and a **Profile** disclosure for account access and Settings. Every view — including card creation, account management, and Settings — has its own URL and uses normal document scrolling, not a modal overlay.

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
npm run test:e2e    # Full Playwright app regression (slower; not needed for every change)
npm run test:pwa    # Build + 4 focused production PWA/notification checks
npm run test:layout # Only fluidity + navigation checks; no full app suite
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

- One fixed navigation keeps all five labeled page links: bottom tabs in compact/portrait-touch layouts and a left rail for qualifying landscape tablets and mouse-based laptops. Active-page indicators and touch targets remain at least 44 × 44 CSS pixels. The top header no longer duplicates the page links.
- Bottom and side safe-area insets are respected. Measured navigation height reserves bottom space only when the bar is at the bottom; a side rail instead insets content horizontally. Toasts center over the usable content, not the whole window.
- Page URLs support direct visits, refresh, browser Back/Forward, and opening links in a new tab. `/timeline` redirects to `/`.
- Calendar selection is reflected in `?month=2026-12` or `?date=2026-11-11`; individual task lists, projects, and journal entries use card-specific paths.
- The app retains shared state while switching pages, restores scroll on Back/Forward, updates browser titles, and focuses page content for keyboard/screen-reader navigation.
- Unknown paths and missing/wrong-type cards have recovery pages rather than silently opening a different item.
- The header’s **Profile menu** (avatar/name button) opens account navigation and **Settings**. Guests get Sign in and Create account; signed-in users get Profile & account and a separate Sign out action. It supports touch, Enter/Space, normal Tab order, Escape, and outside dismissal. The dedicated sign-in screen keeps its quiet brand/back header, without a redundant Profile menu, planning tabs, or New card. Old signed-out `/account?mode=…` links are replaced with their `/sign-in` equivalent.
- **New card** opens a creation page with contextual defaults. Cancel returns to the originating page; successfully creating a card returns to and highlights it on the timeline.

## Included

- Ice-blue Light and restful navy Dark palettes, glass surfaces, self-hosted Plus Jakarta Sans and Newsreader fonts, and a responsive portrait timeline based on the supplied design reference. **Auto** follows the device’s color preference.
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
- A dedicated **Profile → Settings** page for account access, app-wide Light / Dark / Auto appearance, workspace counts/backups, privacy/storage guidance, version, and help. Settings works without sign-in or a working Firebase connection.
- Keyboard-operable navigation, a skip link, one main landmark per page, reduced-motion support, and literal-text rendering through React. No HTML injection or modal focus traps.

## Account access with Firebase

Choose **Profile menu → Sign in** in the header to open the dedicated **`/sign-in`** page. **Create account** in that menu opens registration directly; Settings also provides both links for guests. The sign-in page has a responsive seasonal welcome panel, a clear sign-in card, signup and recovery links, and a **Continue as guest** option. There is no modal, duplicate workspace toolbar, or fixed bottom bar on this entry screen. Device counts and JSON export remain accessible in the collapsed **Your device workspace & backup** section.

After sign-in, `/account` shows profile details, verification, password reset, and sign-out, with the normal five-destination workspace navigation. Signed-in users see their name/initials in the header; **Profile menu → Profile & account** opens this page. A signed-in visit to `/sign-in` returns to `/account`; a signed-out visit to an older `/account` URL goes to the appropriate sign-in mode. These use replacement navigation, not an extra Back-history step.

The supplied **`russapps-kanso-pro`** Firebase web configuration is included; optional `VITE_FIREBASE_*` overrides are listed in `.env.example`. **The project owner must still enable Email/Password in Firebase Authentication.** For the optional Google button, enable Google as well and authorize the exact trusted preview/production hostnames in Authentication settings. A web API key alone cannot configure or verify those settings. See [Firebase Console setup and verification](docs/firebase-setup.md) for the complete steps, browser-popup restrictions, and a manual checklist.

**Google is the only path to online sync.** Guests and email/password sessions remain device-local. A Google-issued Firebase session may sync the active eligible Space; its local cards remain available in this browser and are never hidden or locked by sign-in state. Everyone using the same browser profile can still access local cards while signed out. The page makes this explicit and offers **Export device backup** (JSON export only; no import UI yet). Firebase manages identity/session storage separately. Analytics is not initialized.

Automated authentication tests use mocked SDK boundaries and intercepted Firebase REST responses; they do not create real users, send emails, or verify live Console settings. Guest planning remains available when authentication is offline or misconfigured.

## Install Kanso Pro & work offline

Open **Profile menu → Settings → About & help** (`/settings#about`). A real **Install Kanso Pro** button appears when the browser offers installation; otherwise the page explains its install menu. On iPhone/iPad, open the site in Safari and use **Share → Add to Home Screen**. Installation usually needs the full site in its own tab, not an embedded preview. The manifest supplies standalone launch, New card/Calendar/Journal shortcuts, and platform-appropriate icons.

The new calendar artwork is used in the header, sign-in, footer, About, favicon, and installation icons. Its exterior white background and drop shadow are removed while preserving the cream paper and folded corner. Regular PNGs are transparent; Apple-touch and maskable variants intentionally use an opaque ice-blue platform background. The maskable artwork fits inside the central safe circle.

- **Offline after setup:** visit once online and wait for **Ready offline on this device**. The production service worker precaches the local app shell, fonts, and icons. Offline reloads and direct links work; cards, checklists, journal edits, and appearance keep using their existing local browser storage. Sign-in, account changes, and external help links require internet.
- **Prompt, safe updates:** Kanso checks once at launch, after a minute away, and every five minutes while left open. A new shell installs in the background, then waits for consent. A titlebar action (supported desktop installed apps), browser banner/title, or guest touch toast offers Restart; **About → Check for updates / Reload to update / What’s new** stays available. Open forms require confirmation. Only the consenting tab reloads; other tabs keep their inputs. Updates also activate naturally when old app windows close. Saved cards/preferences are not reset, and the worker retains one previous shell for open tabs.
- **Privacy & limits:** the worker caches only same-origin build files, never Firebase/API traffic, passwords, tokens, or workspace data. Cards and Firebase sessions retain their separate storage rules. Clearing site data or browser eviction can remove offline availability and local plans; installation is not a backup or cloud sync. Export important plans.
- **Production only:** registration requires HTTPS (localhost is allowed for development checks). `npm run dev` does not register a worker, avoiding stale development assets. Use `npm run build && npm run preview` to try the installed/offline experience; Vercel receives the same static files and service-worker/manifest cache headers. No deployment is performed by this change.

For small PWA changes, run **`npm run test:pwa`**, not the full browser suite: it builds once and runs four production checks covering manifest/installability/icons and explicit permission denial, offline direct-load/save/reload with appearance persistence, same-version suppression and consent-based updates with another tab’s unsaved draft, and quiet-hour summary delivery with generic lock-screen text. The dependency-free build plugin stamps HTML and worker with the same deterministic `version+buildhash`; the newest `src/lib/whats-new.json` entry must match the package version. No PWA package or remote CDN is required. Physical-device installation and Safari remain manual checks.

## Notifications & app updates

Open the **header bell → Notifications** (`/notifications`). It is a full page, not a new planning tab; the quiet sign-in header has no bell. Unread counts cap visually at **9+**. Read individual items or **Mark all read**. The newest **60** notifications are retained; card links open the actual Calendar, Tasks, or Projects page. Foreground reminders use actionable toasts, grouped when several arrive. Notification navigation and restart actions ask before replacing an open form; saved plans and other tabs' drafts stay intact.

Reminders are derived from actual local cards and the **device clock**, not the sample `FOCUS_DATE`:

| Card | Reminder |
| --- | --- |
| Event | Start time, or **08:00** for all-day events |
| Task | Reminder time on its card date, or **09:00** if none is set |
| Project | **09:00** on its due date |
| Journal note / fully completed nonempty task or milestone list | No reminder |

Existing overdue plans are silently baselined on first use. Later checks catch missed deadlines when reopening and deduplicate each card/deadline. Category switches skip muted deadlines, rather than flooding them when re-enabled. Checks run about once a minute while the page can execute, and on focus/return; browser suspension may delay them.

**Phone notifications are off by default.** Only an explicit opt-in requests browser permission, with blocked/unsupported/iPhone installation guidance. Supported production browsers can deliver generic, privacy-conscious system notifications while the page is backgrounded and still executing; private titles/notes are never included in lock-screen text. More than three are grouped. Default **19:00–06:00 quiet hours** pause phone delivery, not the inbox; queued reminders summarize when execution resumes outside quiet hours (or appear in-app on return). Installed-app badging is optional and feature-detected. **There is no push server, closed-app scheduler, or Periodic Background Sync.** Fully closed/suspended apps cannot promise alarms; reopening catches up. Use your device calendar/alarm for critical deadlines.

Inbox, baseline, read state, and preferences use **`kanso-pro:notifications:v1`**, separate from journey cards, account sessions, and JSON backups. This is the **shared browser-profile workspace**, available signed out—not an account-private feed or cloud sync. Account changes never partition, upload, or delete cards. Blocked storage keeps the inbox in memory for the current session and displays a warning.

App-update checks run on return after **30 minutes**, **hourly** while open, and manually in **Settings → About & help**. A page/worker version handshake avoids announcing the same build and handles a new page still controlled by an older shell. Later/dismissal is session-only; About and its Update badge remain available. Signed-in touch users also get a local update inbox entry. After an updated build opens, a once-per-device-build toast links to **What’s new** (`/whats-new`); first installation is silent, and build-only changes use an up-to-date message instead of recycling release notes. Open-form detection is intentionally conservative: any open form prompts before restart, even if it has not been edited.

Focused checks (without the full app regression):

```sh
npx vitest run src/lib/notifications.test.ts src/lib/updates.test.ts
npx playwright test tests/notifications.spec.ts
npm run test:pwa
```

## Light, Dark, and Auto

Open **Profile menu → Settings → Appearance** (or `/settings#appearance`):

- **Light** keeps the bright, ice-blue appearance, regardless of the device setting.
- **Dark** uses a coordinated navy palette across navigation, cards, forms, journal paper, calendar, occasion controls, Settings/Profile, account/security, sign-in/create/reset, feedback, and recovery pages.
- **Auto** is the default. It follows the browser/device’s `prefers-color-scheme`, including changes while the app is open. Switching back to Auto uses the latest device setting; no reload is needed.

The native radio group supports arrow keys, a visible focus ring/checkmark, and full-card touch targets. The current resolved appearance and save status are shown underneath. Mode changes do not reset drafts or change cards, dates, selected months, account state, or the automatic seasonal scenes. Monthly washes adapt to the mode; original occasion illustrations keep their intended colors and readable text scrims.

Color mode is a separate device/origin preference under **`kanso-pro:appearance:v1`**, containing only `{ "version": 1, "mode": "light" | "dark" | "auto" }`. It is not per account, does not migrate/overwrite the version-one journey or legacy saves, and is **not included in journey backups**. Same-origin tabs follow the saved choice. Missing/invalid settings fall back to Auto; blocked storage keeps the choice in memory for the current session and shows **Not saved**. A synchronous head script applies the saved/system appearance before React renders, in both development and production.

Reduced-motion and forced-color/high-contrast behavior remain available. Print uses a light palette and hides decorative backgrounds and navigation. Automated Chromium/axe coverage checks both modes, all twelve dark monthly palettes, live device changes, keyboard/touch, storage failures, persistence, cross-tab drafts, and light printing. Physical iPad/Safari and assistive-technology checks are still recommended.

## A sign-in page that follows the month

The sign-in, account-creation, and password-recovery screens reuse the **same twelve local monthly scenes** listed below. The page wash, background vectors, featured illustration, month/year label, and seasonal title all follow the **real current month on the device**. They are not tied to the November 2026 sample, a Calendar selection, or a `month` URL parameter.

- An open page checks again just after **local midnight**, so a month/year change does not require a reload. It also refreshes on tab focus, page restoration, and return to a visible tab after suspension or a device-clock/timezone change.
- Scheduling uses the next local date, handles daylight-saving days, and avoids month-long browser timeouts. No server cron job, location permission, API request, or fixed-month preference is needed. The separate color-mode preference does not choose the month.
- Changing scenes does not reset entered form fields, passwords, feedback, or workspace cards. Artwork stays static and decorative; plain, mode-adapted form surfaces preserve contrast, touch targets stay at least 44 pixels, and narrower/keyboard-height windows use normal page scrolling.
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
- The monthly scene is derived from the view; there is no fixed-month preference or journey-schema migration. Every page follows the separate Light / Dark / Auto color preference, including Tasks, Projects, Journal, New card, and recovery pages.

## Special-occasion backgrounds

Events can use four original, self-contained **vector illustrations**:

- **Birthday** — cake, balloons, and bunting.
- **Celebration** — a star, ribbons, and confetti.
- **Holiday** — a sunlit shore, waves, and a palm.
- **Remembrance** — a candle and quiet leaves.

On **New card → Event**, the **Occasion background** picker shows a live preview. **Automatic** suggests a theme from the title (for example, “Mia’s birthday,” “Graduation,” or “All Souls’ Day”); ordinary meetings stay unillustrated. Choose any theme yourself, or **No illustration** to turn the artwork off. A manual choice always wins over title detection.

For an existing event, open it in **Calendar** and expand its **Background** row. Changes apply immediately to the calendar and timeline and are saved with that event on this browser. There is no modal or separate Save step. Choosing an illustration does not change an event’s dates, ownership, or actual holiday status.

The artwork is local SVG, not copied Google Calendar imagery and not an external calendar integration. It scales without image downloads; decorative SVGs stay out of the accessibility tree, and screen-relative dark overlays protect text contrast on narrow layouts. Background tiles and the inline expander have touch targets at least 44 × 44 CSS pixels. Existing version-one saves without an occasion field keep their data and default to automatic detection.

## Touch-aware fluidity

Kanso Pro distinguishes tablets with **`pointer: coarse`**, not width alone. Layout changes use CSS, not JavaScript device sniffing, `zoom`, or a scaled canvas. Typography, spacing, layout dimensions, and UI icons use **rem** so root scaling enlarges the whole interface; viewport breakpoints, hairline borders, and vector artwork coordinates stay independent.

| Device / window | Root text scale | Main navigation | Calendar / agenda |
| --- | --- | --- | --- |
| Phone, including short landscape windows | Normal | Bottom tabs | Compact responsive layout |
| Touch split view, 640–699 px wide and 600 px+ tall | Normal; finger-size controls | Bottom tabs | Single column |
| Portrait touch tablet, 700 px+ wide and 600 px+ tall | `clamp(16px, 100vw / 42, 20px)` | Bottom tabs | Single column |
| Landscape touch tablet, 1000–1299 px wide and 600 px+ tall | Up to 20 px | **13 rem** sidebar, **3 rem** rows | Single column |
| Landscape touch tablet, 1300 px+ wide and 600 px+ tall | 20 px | 13 rem sidebar | Side by side when content space permits |
| Fine-pointer laptop/desktop, 1024 px+ wide | No tablet scaling | **14.5 rem** sidebar | Wider content and responsive columns |

Touch controls grow to at least **2.5 rem**, never below the existing 44 px floor, at 640 px+ width / 600 px+ height. Small icon controls grow with their targets. Native text fields stay at least 16 px on touch to avoid an extra focus zoom. The 600 px height guard intentionally keeps sideways phones and short keyboard windows compact rather than identifying them as tablets.

The top header spans the full window. The same five navigation links move into the sidebar—no duplicated navigation or sixth planning destination. Active rail links get a 3 px accent stripe; touch rail links avoid sticky hover, and dark/forced-color palettes remain supported. Settings, account panels, entry composition, and calendar columns use **container queries** so they reflow for their actual available space, including the rail. The dedicated sign-in/create/reset page never gets a rail or planning tabs. Existing monthly SVG scenes are retained, not replaced by remote images or fixed seasonal pictures.

All views stay normal pages with direct URLs, history, focus, and document scrolling. Rotation/split-view changes do not remount forms or reset cards, appearance, or auth. CSS alone owns the breakpoint query; the Timeline reads its `--navigation-layout` result when calculating the visible month rather than maintaining a second JavaScript media query. Navigation measurement and footer/scroll clearance adapt to both orientations.

For a layout change, run `npm run build` and **`npm run test:layout`**, not the complete suite. Focused verification covered 22 touch/fine-pointer viewport combinations, 999/1000, 1023/1024, 1299/1300 and 599/600 boundaries, rotation with focused drafts, phone/tablet sign-in field preservation, Timeline month selection, history, safe areas, toast placement, and print. The initial eight layout/navigation checks passed together; the expanded rotation/sign-in and sidebar-month checks also passed individually after final polish. The strict production build includes 1,752 modules and still prepares 23 local PWA shell assets. No dependency was added, and no full app-suite rerun is claimed.

This is an **iPad-inspired responsive web app**, not a native iPadOS app or Apple HIG certification. Automated Chromium/touch checks and reviewed portrait/landscape/dark screenshots do not replace physical iPad/Safari, on-screen-keyboard, or assistive-technology testing.

## Data and scope

The initial eight cards reproduce the **November 2026 sample journey**. Six cards are on the main stream; two live inside the November 3–9 quiet buffer. `FOCUS_DATE` in `src/data.ts` is deliberately set to **2026-11-14** to keep the supplied example consistent. “Focus Active” finds the project due on that date rather than the old meeting.

This is a **local-first workspace with Firebase Authentication**, not a cloud-synced planning service. “Live Flow” means the pages share live card state on this device. Authentication stores account identity/session information in Firebase; it does not synchronize workspace content. There is no external calendar import, remote team collaboration, push notification server, or Google Sheets synchronization. Seeded calendar source descriptions and team names are sample planning metadata. Local reminders use the device clock while the app can run; they are not guaranteed closed-app device alarms.

Changes are stored in `localStorage` under `kanso-pro:journey:v1`. Every Kanso-owned Web Storage key, the journal-attachment IndexedDB database, Firebase app instance, and offline-cache prefix is similarly Kanso-specific. Existing data under `chronos-flow:journey:v1` is read automatically when there is no valid Kanso Pro save, so the rebrand preserves earlier edits and preferences. The old key is left untouched. A valid Kanso Pro save takes precedence on subsequent visits.

Data remains in the current browser profile and site origin; it is not encrypted or synchronized across devices. Deploying the app does not add cloud storage or copy preview data to the production domain. Clearing site data resets the sample. Avoid storing sensitive information in a shared browser profile; signing out does not hide or partition these local cards. Browser storage is fundamentally origin-scoped, not path-scoped: Kanso’s names prevent accidental collisions with sibling GitHub Pages projects, but a separate origin is required when untrusted same-origin code must not be able to read its data.

## Structure

```text
src/
  App.tsx                   Shared shell, routes, timeline state, creation actions
  main.tsx                  Browser router, fonts, and React entry point
  types.ts                  Discriminated card and action types
  data.ts                   Sample journey and storage keys
  styles.css                Timeline, card, and workspace component styling
  layout.css                App chrome, full-page layouts, measured navigation clearance
  fluid.css                 Touch scaling, adaptive sidebar, content container queries
  activity.css              Notification inbox/preferences, update chrome, release notes
  occasions.css             Illustrated event surfaces, text scrims, theme picker
  months.css                Subtle month backdrops and calendar hero watermarks
  account.css               Account forms, identity, and shared device summary
  sign-in.css               Dedicated entry layout and responsive seasonal welcome
  settings.css              Profile disclosure and Settings sections/index
  theme.css                 Semantic dark tokens, color picker, adaptive monthly washes, print
  components/
    AppHeader.tsx           Branding, New card, and the Profile disclosure
    ProfileMenu.tsx         Account-aware navigation, dismissal, focus, and sign-out
    SettingsPage.tsx        Device preferences, backup, privacy, version, and help
    ColorModePicker.tsx     Native Light / Dark / Auto radio group and save/current status
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
    appearance.ts           Validated color preference, resolution, before-paint script
    useAppearance.ts        App-wide color/media/storage controller, session fallback
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
tests/navigation.spec.ts     Adaptive navigation, touch, safe areas, and clearance
tests/fluidity.spec.ts        Touch/fine-pointer breakpoints, rotation/drafts, rail month reading
tests/occasions.spec.ts      Background creation/editing, sync, layout, keyboard, axe
tests/months.spec.ts         Twelve scenes, month/scroll/history sync, layout, contrast
tests/account.spec.ts        Auth flows, persistence, privacy, backup, layout, axe
tests/sign-in.spec.ts        All monthly scenes, clock/timezones, live rollover, responsive/axe
tests/settings.spec.ts       Profile/Settings links, focus/touch, auth/storage faults, backup, axe
tests/appearance.spec.ts     Full-app modes, live Auto, prepaint, persistence, all-palette axe
tests/pwa/                  Three focused production-only install/offline/update checks
scripts/pwa.ts              Dependency-free, build-hashed app-shell precache generator
src/service-worker.js       Same-origin shell only; no auth or workspace caching
public/manifest.webmanifest  Standalone installation metadata and app shortcuts
public/icons/               Cutout branding, Apple touch icon, and safe-zone maskable icon
tests/helpers/firebase.ts    Test-only REST interception; no production auth bypass
docs/firebase-setup.md       Provider/domain setup, data boundary, manual verification
docs/settings-plan.md        Implemented Settings specification and acceptance results
```

## Settings through Profile

Open the header’s **Profile menu → Settings**, or visit **`/settings`** directly. Settings is a normal full page, not a modal or a sixth bottom destination. Its section index is beside the content on larger screens and wraps above it on phones; each section has a shareable anchor:

- **Profile & account** (`#account`): identity/status and a link to the existing account/security page, or sign-in/create links for guests. No duplicate authentication forms.
- **Appearance** (`#appearance`): functional **Light**, **Dark**, and **Auto** choices for the whole app, replacing the old Settings frame switch. Changes apply immediately, survive reload, and synchronize across same-origin tabs. A decorative preview still follows the actual device-local month. The independent **Tablet frame** quick button remains on the Timeline toolbar.
- **Device workspace & backup** (`#workspace`): live card counts, storage status, and JSON export for guests and signed-in users. A download contains workspace data only and is not cloud sync or a verified off-device backup. Download errors leave the workspace unchanged.
- **Privacy & storage** (`#privacy`): browser-profile/origin scope, shared-device access, blocked-storage/session-only behavior, and the separate account session. Another device or host has its own workspace.
- **About & help** (`#about`): the version from `package.json`, PWA installation/offline/update status, a brief usage guide, and real source/setup documentation links. Build-time source links follow the current Git branch (or Vercel’s commit-ref metadata), with `main` as the archive fallback.

The page stays usable when authentication or device persistence is unavailable. The version-one journey schema and storage key are unchanged; no identity is added to cards or exports. The sign-in page’s existing guest backup remains available too. Restore/import/reset, cloud sync, and integrations are deliberately **not** included.

The [implemented Settings specification](docs/settings-plan.md) records the reference review, interaction contract, acceptance checks, and verification scope.

## Deploy to Vercel or GitHub Pages

The app builds to a static `dist/` directory. Root-hosted Vercel builds keep the default base path (`/`); `vercel.json` supplies the SPA fallback to `index.html`, so refreshing a URL such as `/projects/proj-reading` loads the app instead of a hosting 404. Vercel serves existing static assets before the fallback.

For a GitHub Pages **project site** such as `https://<owner>.github.io/Kanso-Pro/`, build with the project directory explicitly:

```sh
VITE_APP_BASE_PATH=/Kanso-Pro/ npm run build
```

This build keeps public assets, React routing, the manifest identity/start URL/scope, notification icons, and the service worker under `/Kanso-Pro/`. The worker is registered as `/Kanso-Pro/sw.js` with scope `/Kanso-Pro/`; its generated cache namespace also includes an identifier derived from that path, so it neither controls sibling project sites nor shares their offline shell cache. The build rejects URL-like, query/hash, and traversal values for `VITE_APP_BASE_PATH`. It also emits a project-site `404.html` that restores a direct GitHub Pages route before React starts. Do not broaden the worker scope and do not add `localStorage.clear()` as part of deployment or sign-out.

This repository includes `.github/workflows/deploy-pages.yml`, which builds and deploys `main` with that base path. In **Settings → Pages**, select **GitHub Actions** as the source; do not publish the raw branch root. Other static hosts can publish `dist/`, but must rewrite non-file page requests (including `/sign-in`, `/account`, and `/settings`) to `index.html`; for a project site, apply that fallback inside the project directory.

Guest/local planning requires no backend. Account access uses the supplied Firebase project and requires its Authentication provider/domain setup; no environment variables are required unless overriding the default web configuration. Authorize the exact production hostname for Google sign-in when it is assigned.
