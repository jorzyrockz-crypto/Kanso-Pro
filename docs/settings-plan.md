# Dedicated Settings through the Profile menu

**Status: implemented and verified on 2026-11-14.** The header now opens an accessible Profile disclosure, and **Profile → Settings** leads to the dedicated `/settings` page. The user subsequently expanded Appearance to functional **Light / Dark / Auto** modes and requested replacing its Tablet frame switch. This document records that approved scope change; the independent Timeline frame toolbar button remains.

## Goal and constraints

Make **Profile → Settings** the home for personal/device preferences and workspace maintenance, without crowding the planning interface.

- Keep Timeline, Calendar, Tasks, Projects, and Journal as exactly five primary destinations. The subsequent fluidity request keeps bottom tabs on phones/portrait tablets and authorizes a left sidebar for fine-pointer laptops (1024 px+) or landscape touch tablets (1000 px+ wide, 600 px+ tall). No sixth Settings tab or top planning row.
- Settings is a normal, refreshable page with its own URL, not a modal, drawer, or full-screen overlay. The Profile menu is only a compact navigation disclosure.
- Preserve the Kanso Pro visual language, monthly sign-in, current Firebase flows, and guest planning.
- Keep account identity separate from browser-local cards. Settings must not imply that sign-in uploads, locks, or separates workspace content.

## Reference reviewed

[Portable-School-Inventory](https://github.com/jorzyrockz-crypto/Portable-School-Inventory), reviewed at commit [`d4e8dfc`](https://github.com/jorzyrockz-crypto/Portable-School-Inventory/tree/d4e8dfcaa8462eede30419c13ac40d3c2ae26372).

The reference uses **More**, not a dedicated Profile → Settings page:

- [Grouped More menu](https://github.com/jorzyrockz-crypto/Portable-School-Inventory/blob/d4e8dfcaa8462eede30419c13ac40d3c2ae26372/index.html#L1401-L1451): Appearance, Account, Data & settings, backups, and About are separated from the everyday work tabs.
- [Account section](https://github.com/jorzyrockz-crypto/Portable-School-Inventory/blob/d4e8dfcaa8462eede30419c13ac40d3c2ae26372/index.html#L18720-L18745): identity/status followed by a distinct sign-in or sign-out action.
- [Appearance behavior](https://github.com/jorzyrockz-crypto/Portable-School-Inventory/blob/d4e8dfcaa8462eede30419c13ac40d3c2ae26372/README.md#L59-L76): explicit device-level preferences, retained after reload and synchronized between tabs.
- [Backup/restore behavior](https://github.com/jorzyrockz-crypto/Portable-School-Inventory/blob/d4e8dfcaa8462eede30419c13ac40d3c2ae26372/README.md#L600-L610): make local-data ownership and maintenance discoverable.

Borrow the grouping, clear identity/status, and device-scoped explanations. Do **not** copy the reference's modal architecture, school roles, cloud-data merge/reset behavior, or assets. Its cloud-synced inventory model is different from Kanso Pro's local workspace.

## 1. Profile menu

The header account link is now an accessible Profile disclosure button. It retains the existing avatar/initials and visible name/status; on narrow screens, the clearly named avatar button has at least a 44 × 44 CSS-pixel target.

| State | Identity summary | Navigation and actions |
| --- | --- | --- |
| Signed in | Display name, email when available, signed-in status | **Profile & account** → `/account`; **Settings** → `/settings`; separated **Sign out** action |
| Guest | Guest · plans saved in this browser, or the existing storage-unavailable warning | **Sign in** → `/sign-in`; **Create account** → `/sign-in?mode=create`; **Settings** → `/settings` |
| Checking account / connection error | Honest checking/unavailable status | Keep Settings and guest workspace navigation usable; show no premature signed-in actions |

Interaction requirements:

- Use a button with `aria-expanded` and `aria-controls`, plus ordinary links/buttons in a labeled disclosure. Do not use ARIA `menu` roles without implementing their full keyboard model.
- Support click/touch, Enter/Space on the trigger, normal Tab/Shift+Tab order, Escape to close and return focus, and outside-click dismissal. No body-scroll lock or focus trap.
- Close on destination selection, route change, sign-out, and account changes. RouteEffects owns destination-page focus; dismissal alone returns focus to the trigger when appropriate.
- Constrain the panel to the viewport and safe areas at 320 px widths and short landscape heights. Give long names/emails readable wrapping and accessible full text.
- Reuse the existing account controller for sign-out and duplicate-action protection. Keep navigation available while an auth operation is pending. Signing out must not clear cards.
- Keep the quiet monthly sign-in header; do not put a redundant Profile menu on the signed-out authentication screens.

## 2. Dedicated `/settings` page

Use the normal workspace header and adaptive five-link navigation (bottom tabs or sidebar). Set the title to **Settings · Kanso Pro**, provide one main landmark, a useful heading/back link, and normal document scrolling. No planning tab should incorrectly appear active on Settings.

Tablet/desktop: a restrained section index beside settings cards. Phone/split view: a single column with wrapping section links. Use the same section anchors in both layouts; nested routes are unnecessary for the first release.

| Section | Implemented scope | Boundary |
| --- | --- | --- |
| **Profile & account** (`#account`) | Identity/status summary and a link to the existing account page for display name, verification, password reset, and sign-out; guests get sign-in/create links | Do not duplicate Firebase forms or store identity in journey data |
| **Appearance** (`#appearance`) | Native **Light / Dark / Auto** choices for the entire app, with current appearance/save status; retain the decorative actual-device-month preview | Auto follows live device color changes; explicit modes override them. No fixed login month. Tablet frame stays only in the Timeline toolbar |
| **Device workspace & backup** (`#workspace`) | Existing card counts, storage/save status, and **Export device backup** JSON action | Export workspace data only, including for guests; clearly state that this is a download, not cloud sync or a verified off-device backup |
| **Privacy & storage** (`#privacy`) | Explain browser/profile/origin scope, shared-device access, blocked-storage behavior, and what changes when using a different host/device | Signing out does not hide cards; no Analytics or card upload is introduced |
| **About & help** (`#about`) | Kanso Pro version, real help/source links, and the subsequently authorized PWA install/offline/update panel | Installation uses the browser’s real prompt when available; updates are service-worker events, not a fake version checker. No notifications |

Keep the existing sign-in guest backup accessible. Settings should be an additional discoverable home for device maintenance, not an auth gate. Existing `/account` and legacy signed-out auth redirects continue to work.

### Data and save behavior

- Reuse the current journey reducer for the existing bezel preference. Do not change the version-one journey schema or duplicate that preference in another storage key.
- Extract the device summary/export logic into reusable helpers/components shared with AccountPage and SignInPage. Preserve JSON content, filename behavior, error feedback, and exclusion of passwords/tokens/identity.
- Render Settings when Firebase is unavailable. Disable only actions that actually require the unavailable service.
- Apply local preferences immediately and synchronize across same-origin tabs. Journey/frame data retains its existing store and schema. Color mode uses the separate validated `kanso-pro:appearance:v1` device key (`version: 1`, `mode: light | dark | auto`), never account/session data. Missing/invalid preferences default to Auto; blocked reads/writes keep a session-only choice and show Not saved. Journey exports deliberately remain version/cards/bezel only.
- Do not label an export as safely saved on disk: the app can initiate a download, but cannot verify where the user kept it.

## 3. Completed implementation

1. **Profile navigation:** added `src/components/ProfileMenu.tsx` and integrated it with AppHeader and the existing account controller. Signed-in/guest/loading/error states, dismissal, pending actions, and focus are tested. Actual destinations remain real links with useful hrefs. Focus is remembered before cross-tab sign-out removes a signed-in-only link; navigation still delegates destination focus to RouteEffects.
2. **Settings page:** added `src/components/SettingsPage.tsx` and `src/settings.css`, with `/settings` routing/title metadata and section focus/history handling in RouteEffects. The responsive section index becomes non-sticky in short windows. All existing account URLs and five bottom links remain intact.
3. **Reuse existing controls:** extracted `DeviceWorkspace.tsx` and `lib/workspaceBackup.ts` for Account/sign-in/Settings. The download helper explicitly exports version/cards/bezel only and cleans up its anchor/object URL on failure too. The Timeline frame button still dispatches the existing reducer action; Appearance no longer duplicates that control. No extra auth controller or journey-schema change was added. Color mode has its own device-only key, outside journey data and exports. About reads the package version and public build-time source ref.
4. **Regression and documentation:** added 22 Settings/Profile browser tests, 8 backup unit tests, and a Settings navigation unit test; updated old account-entry tests to select disclosure links and documented the new entry point. Direct-link, refresh, history, native new-tab, guest, monthly sign-in, and existing planner coverage are preserved.

### Appearance extension

`ColorModePicker.tsx` replaces the Appearance switch with native, accessible Light / Dark / Auto radios. One `useAppearance` controller lives above every route, applies the root scheme immediately, listens to device media/focus/restoration and same-origin storage changes, and preserves mounted forms and all journey data. Invalid cross-tab values/sessionStorage events are ignored; removing the preference restores Auto. No theme dependency or extra auth subscription is introduced.

`appearance.ts` owns validation, scheme resolution, and the shared synchronous head bootstrap, injected before styles/body by Vite in both development and builds. It sets root mode/scheme metadata and browser theme-color without a saved-Light flash. CSS uses semantic dark tokens with the original light colors as component fallbacks. All routes/chrome/fields/feedback/journal/calendar/occasion editing adapt. Dark month washes resolve alongside each real-month palette; original SVG illustrations are not inverted or replaced. Screen-only tokens keep printing light; contrast, forced colors, and reduced motion remain supported.

Added preference/bootstrap unit tests and `tests/appearance.spec.ts` coverage for live Auto/explicit overrides, initial/prepaint rendering, reload/cross-tab/session-only storage, old journeys, field preservation, keyboard targets, all routes in both modes, all twelve dark monthly palettes, signed-in/error/occasion controls, forced colors, and printing. Existing Settings tests now exercise color modes instead of the removed switch while retaining Timeline frame/backup/schema coverage.

## Acceptance results

- [x] Profile → Settings works with mouse, keyboard, and touch, both signed in and as a guest.
- [x] `/settings` works on direct load, refresh, Back/Forward, and in a new tab; unknown routes still show recovery pages.
- [x] Settings is a page, not a modal. Primary navigation stays fixed, reachable, and limited to its existing five destinations; the later fluidity request adapts its placement without changing routes.
- [x] Escape/outside dismissal and route navigation leave focus in the correct place; no hidden disclosure items remain in the tab order.
- [x] Phone, split-width tablet, portrait/landscape, safe-area, and keyboard-height layouts have no horizontal overflow or obscured final controls; targets stay at least 44 × 44 px.
- [x] Profile/security flows, legacy redirects, and sign-out/cross-tab sessions continue to work. Offline or misconfigured auth never blocks local settings or guest plans.
- [x] Light / Dark / Auto adapt the entire UI immediately, survive reload, synchronize across tabs, and do not change card content. Auto follows live device changes; explicit modes stay fixed. The Timeline frame quick toggle and its saved data remain functional.
- [x] Guest/signed-in exports contain only valid workspace JSON; download errors and blocked/corrupt storage are handled without data loss.
- [x] Monthly sign-in still follows the actual device-local month across midnight/year boundaries and tab restoration without losing typed fields.
- [x] Targeted WCAG A/AA, reduced motion, forced colors, contrast, and print checks pass. A full expanded browser rerun was interrupted; see the exact scope below.

## Verification scope

Completed pre-appearance Settings baseline (retained for reference):

- `npm run build` — strict TypeScript and production build pass (1,745 modules).
- `npm test` — **127 tests pass across 9 files**.
- `npm run test:e2e` — **99 browser tests pass**, including all 22 Profile/Settings tests, existing authentication flows, the actual-clock monthly sign-in tests, and the complete planner suite. No retries or app-side new-tab workarounds.
- `npm audit` — **0 vulnerabilities**; no dependency changes were required for Settings.
- `git diff --check` — clean.

Browser coverage includes 320/375 px phones, 600/760 px split widths, 834 px portrait tablet, 1194 px landscape/tablet, and 1440 px desktop. Short 375 × 420 and 812 × 320 windows, touch, keyboard, simulated side/bottom safe areas, long literal identity text, native modified-click tabs, blocked/corrupt/empty storage, pending/failed auth, cross-tab sessions/preferences, private JSON downloads, and download failures are exercised. Representative phone/tablet/desktop/landscape and forced-color captures were visually reviewed.

Axe WCAG A/AA checks include every monthly Settings-preview palette and expanded guest/signed-in Profile disclosures. Reduced-motion, increased-contrast, forced-color, and print styles are checked. These are automated/browser-emulated checks, **not** certification or a substitute for physical iPad/Safari, assistive-technology, and real on-screen-keyboard testing. Authentication uses test-only SDK faults and intercepted REST responses; no live accounts/emails or Console configuration were used or verified.

### Subsequent appearance and PWA verification

- Theme builds and **161 unit tests across 10 files** passed. The first expanded browser run passed **112/115**; three test-readiness failures were fixed and each passed three focused repeats. The later full rerun was stopped by the user after **81 passing tests**; it is **not** recorded as a completed 115-test pass and was not restarted.
- Six production appearance combinations (Light/Dark/Auto × light/dark device) passed initial prepaint, mounted selection, native-control scheme, and live system-change checks.
- PWA validation is deliberately scoped: strict TypeScript/production build, icon transparency/dimensions/maskable safe-zone checks, and **three production browser tests** for native manifest/installability, offline direct links and local saving with appearance persistence, and waiting/consented updates without reloading another tab’s unfinished form. Run `npm run test:pwa`; no full app suite is required for a small PWA change.
- PWA integration adds **no third-party dependency**. `npm audit` reports **0 vulnerabilities**. No physical-device install, live Firebase action, Vercel deployment, or production release is claimed.

### Subsequent fluid layout

The user subsequently approved touch-first fluidity: rem-based scaling only for coarse-pointer tablet-size/tall windows; finger-size controls; a 14.5-rem laptop rail or 13-rem landscape-touch rail; bottom tabs retained on portrait tablets, split views, phones, and short landscape windows. Container queries prevent Settings/account/calendar panels from being squeezed by a rail. Sign-in never gets planning navigation, and monthly vector scenes are retained.

Build/validation was scoped rather than restarting the full suite: eight layout/navigation checks passed together, including 22 touch/fine-pointer viewport cases; the expanded rotation/sign-in-field check and the sidebar/portrait Timeline-month regression passed individually after final polish. Strict build passed (1,752 modules; 23 PWA shell assets). Existing routes, storage schema, cards, drafts, color mode, and auth architecture are unchanged. Physical-device verification remains manual.

## Still deferred

- **Optional artwork-visibility or fixed-month preferences:** not requested. Light / Dark / Auto are now implemented; the automatic actual-month login behavior remains intact.
- **Restore/import, reset, or delete-local-data controls:** require a separate proposal for validation limits, preview, explicit scope/confirmation, backup recommendation, and recovery/undo. No destructive action is introduced by this plan's first release.
- **Cloud workspace sync, teams/school roles, account deletion, notifications, and external integrations:** require separate authorization/data architecture and user approval. The reference's cloud capabilities must not be implied by a Settings page.
