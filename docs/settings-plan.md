# Dedicated Settings through the Profile menu

**Status: proposed follow-up, not implemented in this pull request.** The current header still opens `/account` or `/sign-in` directly. This document plans a Profile menu and a dedicated `/settings` page without changing existing runtime behavior.

## Goal and constraints

Make **Profile → Settings** the home for personal/device preferences and workspace maintenance, without crowding the planning interface.

- Keep Timeline, Calendar, Tasks, Projects, and Journal as the five bottom-bar destinations. Do not add a sixth Settings tab or move navigation back to the top.
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

Replace the header account link with an accessible Profile disclosure button. Keep the existing avatar/initials and visible name/status; on narrow screens, use a clearly named avatar button with at least a 44 × 44 CSS-pixel target.

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

Use the normal workspace header and bottom bar. Set the title to **Settings · Kanso Pro**, provide one main landmark, a useful heading/back link, and normal document scrolling. No planning tab should incorrectly appear active on Settings.

Tablet/desktop: a restrained section index beside settings cards. Phone/split view: a single column with wrapping section links. Use the same section anchors in both layouts; nested routes are unnecessary for the first release.

| Section | Initial scope | Boundary |
| --- | --- | --- |
| **Profile & account** (`#account`) | Identity/status summary and a link to the existing account page for display name, verification, password reset, and sign-out; guests get sign-in/create links | Do not duplicate Firebase forms or store identity in journey data |
| **Appearance** (`#appearance`) | Expose the existing Tablet frame preference; explain automatic monthly artwork and show a small decorative current-month preview | Mirror the same `state.bezel` value as the Timeline quick toggle; no fixed login month or new theme modes in the first release |
| **Device workspace & backup** (`#workspace`) | Existing card counts, storage/save status, and **Export device backup** JSON action | Export workspace data only, including for guests; clearly state that this is a download, not cloud sync or a verified off-device backup |
| **Privacy & storage** (`#privacy`) | Explain browser/profile/origin scope, shared-device access, blocked-storage behavior, and what changes when using a different host/device | Signing out does not hide cards; no Analytics or card upload is introduced |
| **About & help** (`#about`) | Kanso Pro version from build/package metadata, concise help, source/setup documentation links | No fake update checker, install button, notifications, or unsupported service-worker claims |

Keep the existing sign-in guest backup accessible. Settings should be an additional discoverable home for device maintenance, not an auth gate. Existing `/account` and legacy signed-out auth redirects continue to work.

### Data and save behavior

- Reuse the current journey reducer for the existing bezel preference. Do not change the version-one journey schema or duplicate that preference in another storage key.
- Extract the device summary/export logic into reusable helpers/components shared with AccountPage and SignInPage. Preserve JSON content, filename behavior, error feedback, and exclusion of passwords/tokens/identity.
- Render Settings when Firebase is unavailable. Disable only actions that actually require the unavailable service.
- Apply local preferences immediately, persist through the existing validated store, synchronize across same-origin tabs, and retain the existing in-memory fallback and warning when storage fails.
- Do not label an export as safely saved on disk: the app can initiate a download, but cannot verify where the user kept it.

## 3. Implementation sequence

1. **Profile navigation:** add `src/components/ProfileMenu.tsx`, integrate with AppHeader, and test signed-in/guest/loading/error states and dismissal/focus behavior. Actual destinations remain real links with useful hrefs.
2. **Settings page:** add `src/components/SettingsPage.tsx` and `src/settings.css`; wire `/settings` into App, navigation title metadata, and RouteEffects. Keep all existing account URLs and five bottom links.
3. **Reuse existing controls:** share workspace summary/export behavior; connect the Tablet frame setting to the existing reducer. Do not add a second auth subscription or export account credentials.
4. **Regression and documentation:** add Settings/Profile browser coverage, update account-entry test helpers that currently assume `.personal-workspace` is a direct link, and document the new entry point. Preserve direct-link, refresh, history, new-tab, and guest coverage rather than removing those assertions.

## Acceptance checklist for that implementation

- [ ] Profile → Settings works with mouse, keyboard, and touch, both signed in and as a guest.
- [ ] `/settings` works on direct load, refresh, Back/Forward, and in a new tab; unknown routes still show recovery pages.
- [ ] Settings is a page, not a modal. Bottom navigation stays fixed, reachable, and limited to its existing five destinations.
- [ ] Escape/outside dismissal and route navigation leave focus in the correct place; no hidden disclosure items remain in the tab order.
- [ ] Phone, split-width tablet, portrait/landscape, safe-area, and keyboard-height layouts have no horizontal overflow or obscured final controls; targets stay at least 44 × 44 px.
- [ ] Profile/security flows, legacy redirects, and sign-out/cross-tab sessions continue to work. Offline or misconfigured auth never blocks local settings or guest plans.
- [ ] The Tablet frame setting and Timeline quick toggle stay synchronized after reload and across tabs without changing card content.
- [ ] Guest/signed-in exports contain only valid workspace JSON; download errors and blocked/corrupt storage are handled without data loss.
- [ ] Monthly sign-in still follows the actual device-local month across midnight/year boundaries and tab restoration without losing typed fields.
- [ ] Automated WCAG A/AA checks, reduced motion, forced colors, contrast, and print behavior pass; rerun the complete existing unit/browser suite.

## Deferred decisions, not part of the initial Settings release

- **System / Light / Dark** themes and optional artwork-visibility preferences: the reference is useful, but these require a complete Kanso palette/design and accessibility review. Do not add nonfunctional switches or replace the required automatic monthly login behavior.
- **Restore/import, reset, or delete-local-data controls:** require a separate proposal for validation limits, preview, explicit scope/confirmation, backup recommendation, and recovery/undo. No destructive action is introduced by this plan's first release.
- **Cloud workspace sync, teams/school roles, account deletion, notifications, and external integrations:** require separate authorization/data architecture and user approval. The reference's cloud capabilities must not be implied by a Settings page.
