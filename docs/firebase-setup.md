# Firebase account setup

Kanso Pro uses the modular Firebase JavaScript SDK for the **`russapps-kanso-pro`** web app. The header’s account badge opens `/sign-in` for guests and `/account` for signed-in users. Both are normal pages, not modals. This change does not provision a Firebase project, configure providers, or deploy the app. Real users are created only when someone submits the account-creation form (or completes a first Google sign-in).

## One-time Console setup

An owner of the project must check these settings in the [Firebase Console](https://console.firebase.google.com/project/russapps-kanso-pro/authentication/providers). The supplied web configuration identifies the project; it does **not** grant administration rights or prove that providers are enabled.

1. Open **Build → Authentication → Get started** if Authentication has not yet been initialized.
2. Under **Sign-in method**, enable **Email/Password** (the password option, not email-link sign-in). Save. This enables account creation, email/password sign-in, and password reset.
3. To use **Continue with Google**, also enable **Google**, select a project support email, and save. Google is optional; email/password and guest access do not depend on a Google OAuth popup.
4. Open **Authentication → Settings → Authorized domains**. Add the **exact trusted hostname**, without a scheme, port, slash, or path, for each site where you use Google sign-in:
   - Arena: copy the hostname from the current live preview, such as `5173-<sandbox-id>.e2b.app`. New sandbox previews can have new hostnames; add each one you trust. Do not add `.e2b.app` as a blanket domain.
   - Local development: `localhost` and/or `127.0.0.1`, as used in your browser. Do not assume they are already authorized.
   - When deployed later: the actual production `<your-project>.vercel.app` hostname and any custom domain. Add a branch/deployment preview hostname separately only if you intend to use sign-in there. Do not authorize all of `vercel.app`.
5. If the web API key has HTTP-referrer or API restrictions, ensure the intended domains and Firebase Authentication APIs are allowed. Keep restrictions scoped to your trusted app sites; do not place Admin SDK keys in the frontend.
6. Review **Authentication → Templates** for verification/password-reset sender names and email templates. The app uses Firebase’s hosted email-action handler and does not hard-code a preview-domain return URL. Complete the action from the email, then return to `/sign-in` (or `/account` if still signed in).

The authorized-domain list is relevant to Google OAuth and email redirect continuation settings; basic email/password sign-in does not use an OAuth redirect. A disabled provider is a separate configuration problem. The app shows readable setup errors instead of treating a failed request as a successful sign-in.

### Embedded preview and browser restrictions

Google uses a separate, user-initiated provider window; the Kanso sign-in and account pages themselves are never modals. Some embedded previews, privacy settings, and browsers block provider windows or third-party auth storage. Open the preview in its own browser tab, allow a popup for that trusted site, or use email/password. The app does not silently switch to a redirect that could lose your current page.

## What is implemented

- `/sign-in`: email/password and optional Google sign-in on a dedicated monthly illustrated entry screen, with guest access and a minimal brand/back header.
- `/account`: signed-in identity, profile display-name editing, explicit email verification/status refresh, password-reset email, and sign-out. It retains the regular workspace navigation.
- `/sign-in?mode=create`: validated display name, email, and a password of at least eight characters. Firebase’s configured password policy remains authoritative. Existing accounts with shorter passwords can still sign in.
- `/sign-in?mode=reset`: password recovery with a generic confirmation for unknown addresses. Raw SDK exceptions, tokens, and request payloads are not displayed.
- Legacy signed-out `/account` URLs redirect with replacement history to `/sign-in`, preserving supported create/reset modes. A signed-in visit to `/sign-in` returns to `/account`.
- Reload and same-origin cross-tab account state through Firebase Auth. Persistence tries IndexedDB, local storage, then in-memory storage. If the browser blocks persistence, the account can be used for that session but is not remembered after a reload.
- In-flight action protection and non-blocking error states. Navigation and guest planning remain available if sign-in fails or is offline.
- A local **Export device backup** JSON download. It contains the workspace’s version-one card state, not Firebase credentials or tokens. There is no import/restore UI in this change. Guest users can expand **Your device workspace & backup** below the sign-in card to download without signing in.

Sign-up creates the account first and then saves its display name. If only that second request fails, the page correctly keeps the created account signed in and invites a profile retry. It never retries account creation automatically. Verification and reset emails are sent **only** after you press their buttons.

## Monthly sign-in appearance

The full-page wash, decorative vectors, welcome illustration, scene title, and month/year badge reuse the existing twelve monthly scenes. All login/signup/recovery modes follow the current **device-local month**, independently of the sample journey and Calendar query parameters. An open screen checks after local midnight and on focus, visibility, and page restoration, so year changes and resumed tabs do not require a reload. This uses local date/timers, not a Firebase request, cron job, new storage key, or Analytics event. Form entries are retained during scene updates, and decorative art is static/non-interactive with contrast/print fallbacks.

## Data boundary and shared-device privacy

**Authentication is not workspace synchronization or a lock on device data.**

- Card content remains in the existing `kanso-pro:journey:v1` browser-origin storage, including legacy migration behavior. No Firestore database, Storage bucket uploads, or cloud card collections are initialized.
- Sign-in/sign-out does not upload, migrate, overwrite, clear, or partition local cards. Switching accounts in the same browser profile shows the same local workspace.
- Anyone using that browser profile can open the cards, including while signed out. Use a separate browser profile/device for private plans; signing out alone does not hide local content.
- Firebase stores the identity and authentication/session information required to sign in. The app’s card state and JSON export never include the password or authentication tokens. Firebase manages its own session storage separately from the workspace key.
- The supplied Analytics measurement ID is retained as public web configuration, but **Analytics is not initialized**, and no analytics events are sent by the app. Authentication does not require tracking.
- Moving from the Arena preview to Vercel changes the browser origin. It does not copy either local cards or sign-in state to the new origin. Export important device content before changing hosts.

Cloud workspace storage and per-user access rules would be a separate feature with an explicit migration/guest-data decision. No insecure Firestore rules or pretend cloud-sync indicators are added here.

## Configuration and deployment

The supplied web configuration is the default in `src/lib/firebase.ts`, so an `.env` file is optional. `.env.example` lists all `VITE_FIREBASE_*` overrides for another environment. Set overrides in Vercel’s build environment and rebuild when changing them.

All Firebase web configuration values, including the web API key, are public client metadata shipped in the browser bundle. They are not a substitute for enabled providers, authorized domains, security rules, or API-key restrictions. **Never** put a service-account JSON, private key, Admin SDK credential, or other server secret in any `VITE_` variable.

The app remains a static Vite build with the existing Vercel SPA fallback. No server function or deployment is needed for the frontend code change. Authentication requires internet access to Firebase, but existing local planning remains usable if those requests fail. No Vercel deployment is performed here.

The package override for `@grpc/grpc-js` pins a patched compatible 1.x release: Firebase’s umbrella package pulls an older gRPC dependency through the unused Firestore Node build. Only `firebase/app` and `firebase/auth` are imported and bundled by Kanso Pro.

## Verification

```sh
npm run build
npm test
npm run test:e2e
npm audit
```

Date/clock unit tests cover local month selection, leap/year boundaries, and daylight-saving scheduling. Sign-in browser tests cover all twelve scenes, live midnight rollover without losing typed inputs, local timezones, tab restoration, and all palette/accessibility checks. Auth unit tests mock the SDK boundary to verify configuration, input handling, profile partial-success recovery, reset privacy, observer cleanup, and provider calls. Browser tests run the **real Firebase web SDK** with intercepted REST responses for sign-in/create/verify/reset/profile, reload/cross-tab sessions, blocked persistence, no card uploads, duplicate-submit protection, backup downloads, accessibility, and responsive layout. Their test helper intercepts all external requests, so tests do not create production accounts or send real email. There is no auth bypass/test switch in the shipped application.

These automated results do **not** verify the live project’s provider/domain settings or real Google consent/email delivery. After completing the Console setup, manually check in a trusted browser:

1. Create a test account using an email you control; confirm the header identity and saved display name.
2. Request verification, follow the email link, and press **Check verification**.
3. Reload and open a second tab; verify sign-in/sign-out state changes without altering local cards.
4. Request a password reset, complete it in the hosted Firebase flow, and sign in again.
5. If enabled, use Google from each authorized preview/production hostname.
6. Sign out and confirm that `/sign-in` returns with the current monthly scene and the explicitly local device workspace is still present (expand the device-workspace section or continue as guest).

Do not share passwords or verification/reset links in chat or commit them to Git.
