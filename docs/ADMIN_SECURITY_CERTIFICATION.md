# TCash — Admin Identity & Operations Security Certification

This covers only the admin authentication/authorization architecture
rebuilt this pass. Buy, Sell, Wallet, Settlement, History, Receipts,
World ID verification, SIWE, and session architecture were not touched
— every change here is additive (new authorization module, new
endpoint, new hook) or subtractive (removing the phone/password path),
never a modification to the money-moving code paths.

**Tag legend**: 🧪 Verified by automated tests · 📄 Verified through
source code · 🖥️ Verified in local build/dev preview · 🏭 Verified in
production · ❓ Unknown / requires real-device or production
verification.

**This work is committed to the working tree but has not been deployed.**
Nothing below is tagged 🏭 as a result — that tag is reserved for what
was actually observed running on `world-t-mpesa.vercel.app`, and
nothing was, because this hasn't shipped yet. See the note at the end
about what deploying this specifically changes about production
behavior.

## What changed

- **`api/_lib/adminAuth.js`** rebuilt from two admin paths (a phone/
  password session cookie, and a SIWE-wallet match) down to exactly
  one: `requestIsRecognizedAdmin(req)` reads the signed SIWE session
  cookie's wallet address and checks it against
  `getAdminWalletAllowlist()` — a `Set` sourced from the
  `ADMIN_WALLET_ADDRESSES` environment variable (comma-separated,
  supports multiple operators), falling back to a single built-in
  default wallet only when that variable is unset. 🧪📄
- **`api/admin-login.js` deleted.** There is no username, password, or
  separate login endpoint anywhere in the codebase now. 📄
- **`api/admin-session.js` added** — a read-only `GET` that returns
  `{ isAdmin: requestIsRecognizedAdmin(req) }`. This is the only
  interface the client has to "am I an admin," and it can only ever
  report what the server already knows from the existing session
  cookie; it has no side effects and grants nothing itself. 🧪📄
- **Client-side `isAdmin` is no longer a security boundary anywhere.**
  `AdminPage.jsx` and `ProfilePage.jsx`'s admin-desk link both now gate
  on `useAdminSession()` (a new hook wrapping `GET /api/admin-session`),
  not the old localStorage-persisted `user.isAdmin` flag. The
  client-side flag still exists in `authService.js` for one narrow,
  documented, non-privileged purpose (filtering this browser's own
  locally-cached mock order list) — it no longer gates the Admin
  Console, the admin-desk link, or anything privileged. 📄🖥️
- **Structured audit logging added** (`logAdminAction` in
  `api/_lib/log.js`), wired into `api/orders.js`'s admin-only
  status-write path (the one real, server-enforced privileged
  operation in this codebase). Every attempt — success, denied by
  origin check, failed by replay conflict, failed by a store write
  error — produces exactly one record with `requestId`,
  `administrator` (the admin's own wallet), `action`, `target` (order
  id), and `result`. The "success" record fires only after the actual
  write is confirmed, never optimistically before it. 🧪📄
- **59 automated tests pass** (up from 56), including new coverage for
  the allowlist's default-fallback behavior, multi-wallet support, and
  — specifically — that setting `ADMIN_WALLET_ADDRESSES` without the
  default wallet actually revokes it. 🧪
- **Verified in local dev preview**: a non-admin session shows no
  admin-desk link in Profile, and navigating directly to `/tmpesa-admin`
  shows a clean "not recognized as an operator" state — no login form,
  no crash, no console errors beyond the expected "MiniKit not
  installed" (browser preview, not World App). This also exercised the
  fail-closed path for real: the dev server can't serve `/api/*`, so
  `checkAdminSession()` genuinely failed, and the hook correctly
  resolved to "denied," not "assume granted." 🖥️

## 1. Remaining admin security risks

- **None found in the authorization path itself.** The single choke
  point (`requestIsRecognizedAdmin`) has no client-trusted input in its
  decision — it reads only the signed cookie and the server-held
  allowlist. 📄🧪
- **The removed phone/password path is confirmed gone from the
  codebase**, not just unreachable — `api/admin-login.js` no longer
  exists as a file, so there's no dormant endpoint for a future
  reviewer or scanner to even find. 📄

## 2. Remaining authorization risks

- **Environment variable propagation timing is not guaranteed
  instant.** Setting or changing `ADMIN_WALLET_ADDRESSES` in Vercel
  updates what new serverless function invocations see, but Vercel
  does not guarantee every already-warm function instance picks up the
  change immediately — in practice this is typically fast (seconds to
  low minutes) but "server authorization must immediately reflect
  changes" cannot be certified as instant from here without a
  production test. This is the one honest gap between what this turn
  asked for and what a serverless platform can strictly promise. ❓
- **No database-backed allowlist** — this uses environment
  configuration, which the brief explicitly allowed as an alternative
  to a database. A database-backed list would make revocation visible
  in an audit UI and allow per-admin metadata (name, added-by, added-
  at); that's a real but reasonable scope boundary for this pass, not
  an oversight. 📄

## 3. Remaining operational risks

- **Fee settings, mini-app operational settings (PayBill, sell wallet,
  support email), and referral claim approvals are — and were before
  this pass — stored purely in `localStorage`, with no backend at
  all.** This was discovered, not introduced, during this audit
  (`settingsService.js`, `referralService.js`). Practically this means:
  changing these values in the Admin Console only affects the admin's
  own browser, not real users, so the client-side `isAdmin` spoofing
  risk this pass closed was never actually exploitable *for these
  three features specifically* (no shared state to corrupt). But it
  also means the "Admin Operations" surface the brief asked to audit
  is partly cosmetic today — an operator cannot actually change the
  live M-Pesa PayBill number or fee structure for real users through
  this console. This is real, pre-existing product debt, out of scope
  to fix here (it would mean building new backend storage for
  settings/referrals, which is a feature build, not a security fix,
  and the non-negotiable contract for this pass was "only extend...
  secure administration"). 📄
- **Order management, payment review, and settlement approval are
  real** — these operate on the shared Redis/Blob-backed order store
  and are the operations this pass's security work actually covers. 📄🧪

## 4. Remaining audit-log work

- **Order status changes (completed/rejected) are fully audited** —
  every attempt, whatever its outcome, produces one `logAdminAction`
  record. 📄🧪
- **Fee/settings/referral-claim changes have no audit trail**, and
  can't meaningfully get one without also giving them a real backend
  (§3) — logging a client-only localStorage write as if it were a
  privileged server action would be a fabricated audit record, which
  is worse than no record. Flagged honestly rather than papered over.
- **Audit records are Vercel `console.log` output**, same observability
  foundation as the rest of this codebase's logging (queryable in
  Vercel's Logs product, not yet piped to a dedicated immutable store
  or SIEM). "Immutable" here means "not something this application's
  own code can overwrite," not "stored in a write-once ledger" — worth
  being precise about which guarantee actually exists. 📄

## 5. Remaining World App risks

Unchanged from every prior report, because this pass's scope
(authorization logic) doesn't touch device/runtime behavior:

- Session expiration, logout, wallet switching, token refresh, revoked
  admin access, and multi-device behavior are all ❓ unverified on a
  real device — this was true before this pass and remains true after
  it. `ON_DEVICE_TEST_SCRIPT.md` is still the instrument for closing
  this and still hasn't been run.
- One specific new question this pass introduces: does re-authenticating
  in World App after an operator's wallet is removed from
  `ADMIN_WALLET_ADDRESSES` correctly show them the denied state on
  their very next action, or is there a caching layer (client or
  Vercel edge) that could show stale "granted" state briefly? 📄 The
  code has no client-side caching of the admin-session result beyond
  the component's own state (a fresh mount always re-checks), but the
  server-side propagation question from §2 still applies. ❓

## 6. Remaining technical debt

- `settingsService.js` / `referralService.js` being localStorage-only
  (§3) is the single largest piece of debt surfaced by this audit —
  larger than anything about the auth rewrite itself.
- Two duplicate copies of the admin wallet constant still exist
  (`api/_lib/adminAuth.js`'s `DEFAULT_ADMIN_WALLET` and
  `api/orders.js`'s `ADMIN_WORLD_WALLET`, used only as a World-
  notification recipient default, not an auth decision) — harmless
  since they're not both authorization-relevant, but worth
  consolidating in a future pass. 📄

## 7. Production readiness of the admin system: 78/100

This score describes the system *as built*, ready to deploy — not
production's current running state, which is still the old phone/
password architecture until this is pushed. Held below 90 by: the
env-var-propagation timing question (§2, genuinely unresolved without
a production test) and the fact that two of the audited "admin
capabilities" (settings, referral claims) don't actually operate on
shared state (§3) — that's a real capability gap, not a security one,
but it affects whether "the admin system" as a whole is
production-complete. The authorization core itself — the part this
turn was actually about — has no known gap.

## 8. Security confidence: 88/100

High confidence specifically in the authorization decision itself:
single server-side choke point, zero client-trusted input, tested
against forged tokens, wrong wallets, and the revocation path
specifically. Not scored higher because "security confidence" for the
system as a whole has to account for the unaudited fee/settings/
referral surface (§3) even though it's low-severity, and because
nothing in this report has been observed running in production or on
a real device — every score in this document is a code-and-test
score, consistent with every certification this project has produced,
never inflated past what was actually checked.

---

**Before this ships**: this is a large, deliberate change to how admin
access works — the phone/password path is gone, not just deprioritized.
Recommend confirming the intended operator wallet(s) are correct in
`ADMIN_WALLET_ADDRESSES` (or that the built-in default is acceptable)
*before* deploying, since deploying without setting that variable
falls back to the single default wallet baked into source — which is
almost certainly the right behavior here (it's the same wallet the
product's real operator has always used), but is worth a deliberate
confirmation rather than an assumption, given this is the only door
into the admin console now.
