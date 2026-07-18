# TCash — Production Readiness Report

Prepared as a security/QA/release audit. Every finding below was verified by
reading the actual code, running the actual build, running the actual test
suite, or computing the actual number (contrast ratios, dependency
vulnerabilities) — nothing here is asserted without a source. Where
something could not be verified (anything requiring a real device inside
World App), that is stated explicitly rather than assumed to be fine.

**Scope note, stated up front:** this pass improved implementation quality
only. No buy/sell/payment/settlement/admin/escrow/verification procedure
changed. Every fix below is either a server-side enforcement of a rule the
product already claimed to have, or a defect that was purely in the
*implementation* of an unchanged procedure.

---

## What changed in this pass (so the findings below are read against the current code, not stale)

- **Payment replay/duplicate-submission fixed**: `api/orders.js` now
  rejects a write if the `paymentReference` (an M-Pesa code or a World
  Pay `transactionId`) already belongs to a *different* order id. Before
  this, the same proof-of-payment could be attached to multiple orders,
  which could have been used to claim multiple payouts against a single
  real payment.
- **Rate limiting added** on `api/admin-login.js` (8 attempts / 10 min per
  IP, Redis-backed when Upstash is configured, in-memory best-effort
  otherwise).
- **CSRF defense-in-depth**: Origin/Referer validated on admin-login and
  on the admin-only order-status write path.
- **Input validation hardened**: `api/orders.js` now bounds batch size (20
  orders/request), string field lengths (256 chars), and amount sanity
  (0 ≤ amount ≤ 1,000,000,000) — see `api/orders.test.js`.
- **6 dependency vulnerabilities resolved** (`npm audit fix`, all
  semver-compatible, build verified green after) — see below.
- **28 real automated tests** now exist and pass (`npm test`) — a
  foundation, explicitly not full coverage; see §6.
- **Two real WCAG AA contrast failures fixed**, computed, not eyeballed —
  see §4.
- **Global keyboard focus indicator added** — there was none, anywhere,
  before this pass.
- **Structured JSON logging added** for admin-login attempts, order
  status writes, and payment confirmations (`api/_lib/log.js`) — captured
  by Vercel's own function logs.

---

## 1. Remaining production blockers

1. **`ADMIN_PHONE` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` are not
   set in Vercel.** The manual admin-login fallback is inert until they
   are. (The primary path — signing into World App as the configured
   admin identity — is unaffected and already works.)
2. **`GET /api/orders` has no authentication at all.** Every order's full
   record — phone number, M-Pesa payout number, wallet address, KES
   amount, World username — is returned to *any* caller, logged in or
   not, admin or not. This is the single most serious open item in this
   report. It is architectural, not a quick patch: fixing it properly
   means issuing a real session token after SIWE verification and
   filtering server-side by verified identity, because today regular
   users have no server-side session at all — the client just asserts
   "here is my userId" and the server trusts it. I did not attempt a
   partial fix here because a partial fix that breaks legitimate
   multi-device order sync would be worse than a clearly-documented gap.
3. **`Access-Control-Allow-Origin: *`** on every `/api/*` route
   (`vercel.json`). This doesn't independently expose anything a direct
   API call couldn't already reach (see #2), but it means a malicious
   webpage's client-side JS can pull that same data from a victim's
   browser without the victim doing anything. I did not change this
   blind — the SIWE cookie already needed `SameSite=None`, which suggests
   World App's WebView has cross-origin quirks I cannot verify without a
   real device, and a wrong CORS tightening could silently break wallet
   auth in the one environment I can't test. **Recommend**: tighten this
   to the deployment's real origin, but test it inside actual World App
   before shipping, not just in browser preview.
4. **No automated coverage of the actual payment flows** (Buy/Sell/World
   Pay/admin fulfillment) — see §6. The 28 tests that exist are real and
   passing, but they cover pricing math, order validation, and haptics,
   not the flows themselves.
5. **Nothing has been run inside real World App.** Every verification
   this project has done, across every session, was browser-preview
   mode. MiniKit's actual runtime behavior — wallet auth, `pay`, haptics,
   deep links, notification permission, offline/reconnect — is unverified
   on-device. See §3.

## 2. Remaining security risks

Ranked by severity, not the order they were found in.

| Risk | Severity | Status |
|---|---|---|
| `GET /api/orders` has no per-user auth (§1.2) | **Critical** | Open, architectural |
| Manual admin-login has no credentials configured yet | **Critical** (until env vars set) | Open, one-time setup |
| `Access-Control-Allow-Origin: *` amplifies #1 to browser-JS attackers | High | Open, needs on-device testing |
| CSRF cookies use `SameSite=None` | Medium | Partially mitigated (Origin check added), root cause (session model) unchanged |
| No per-order ownership check on regular (non-admin-status) writes | Medium | Open — same root cause as #1 |
| Rate limiting is Redis-backed only if Redis is configured; otherwise per-instance-only | Low-Medium | Documented limitation, not silent |
| No CSP header | Low-Medium | Deliberately not added blind — wrong CSP breaks the whole app; needs a real testing pass |
| No injection surface found | — | Verified clean: no raw SQL (no SQL database exists), Redis commands are argv-array not string-built, no `dangerouslySetInnerHTML` anywhere in the React source, the one raw-HTML email template (`buildOrderEmail`) already runs every interpolated value through `escapeHtml` |
| Dependency vulnerabilities | — | **Fixed**: 6 found (`react-router` open redirect – moderate; `undici`, `vite`, `ws` – high, mostly build-tooling not runtime), all resolved via `npm audit fix`, build verified green |

## 3. Remaining World App risks

This project has never had access to a physical device running World
App, and says so plainly rather than inferring "should work" from reading
MiniKit's TypeScript types. Unverified on-device:

- **Wallet connection / SIWE flow** end-to-end (server-side logic was read
  and looks correct — signed, cookie-bound, single-use nonce — but the
  client-side `walletAuth` command's actual behavior inside the WebView
  is unverified).
- **`pay` command** for World Pay sell orders — code review only.
- **Haptics** — `tenderHaptics.js`'s payload shapes were corrected to
  match MiniKit's documented TypeScript types (the old shape was
  confirmed structurally wrong), but "matches the type" and "actually
  buzzes correctly on a real phone" are different claims; only the first
  is verified.
- **Deep links** (`worldapp://mini-app?...`) — format matches
  documentation, untested.
- **Lifecycle / reconnect / offline recovery** — no code exists
  specifically for these; the app has no explicit handling for the
  WebView losing and regaining connectivity mid-flow beyond the generic
  fetch timeout/retry already in `backendService.js`.

## 4. Remaining UX risks

- Two real WCAG AA contrast failures were found and fixed this pass
  (light-mode button text: 3.52:1 → 5.05:1 by making it theme-aware;
  light-mode muted text: 4.45:1 → 5.47:1) — computed with the actual
  relative-luminance formula against the actual hex values, not
  estimated. No further contrast failures found in the current token set.
- No visible keyboard focus indicator existed anywhere before this pass
  (only form `<input>`s had one) — added globally via `:focus-visible`.
- Several small icon-buttons (30–36px) are under the 44×44 platform
  comfort guideline, though they clear WCAG 2.2's actual 24×24 minimum
  (SC 2.5.8) — not a compliance failure, a polish item.
- Reduced-motion had partial coverage (new components had per-component
  guards; several pre-existing looping animations in not-yet-rebuilt
  screens did not). A global catch-all now guarantees full coverage
  regardless of whether an individual component remembers its own guard.
- Profile is still a stat-row dashboard, not yet rebuilt to match the
  rest of the identity/ledger system (flagged repeatedly across this
  project's design passes, still open).

## 5. Remaining technical debt

- The regular-user auth/session model (client-declared `userId`, no
  server-verified session) is the root cause of §1.2/§2's biggest
  findings and of the general "server never trusts client input"
  requirement not being fully met. This is the highest-priority
  architectural debt in the codebase.
- `api/orders.js` is 500+ lines doing storage, validation, security,
  notification, and email templating in one file. It works and is now
  better-tested, but it's due for a split.
- Two parallel order stores exist (Upstash Redis preferred, Vercel Blob
  fallback) with separate code paths for read/write/list — doubles the
  surface area for a bug to hide in one path but not the other.
- Dead legacy CSS from pre-redesign screens (Profile, Support, Guidelines,
  Admin) still exists alongside the new Tender system.

## 6. Missing automated testing

Honest state: **28 tests exist, covering pricing math, order-payload
validation, and haptic composition** (`npm test`). This is a real
foundation, not a decoration — it already caught two genuine bugs during
this session (a haptic-pattern collision, and a `window`-global reference
that made code untestable). It is **not** the "complete testing strategy"
requested. What's actually missing:

- **Unit tests**: only pricing/orders/haptics covered. `authService`,
  `orderService`, `referralService`, `settingsService`,
  `walletPortfolioService` have zero coverage.
- **Component tests**: zero. No React Testing Library / jsdom setup
  exists; nothing renders a component in a test.
- **API tests**: `orders.js`'s pure validators are tested; the actual
  HTTP handlers (mocked `req`/`res`) are not — no test exercises the
  admin-session gate, the rate limiter, or the replay-detection path
  end-to-end.
- **Integration / E2E tests**: zero. No Playwright/Cypress setup.
- **Payment flow tests**: zero automated coverage of Buy → M-Pesa code →
  admin confirm, or Sell → World Pay → admin payout.
- **Regression tests**: none — nothing prevents a future change from
  silently reintroducing the hardcoded-credential or replay-attack
  patterns already fixed twice in this project's history.
- **Accessibility tests**: none automated (this pass's a11y fixes were
  manual code review + computed contrast, not axe-core/Lighthouse CI).
- **Performance tests**: none automated.
- **Security tests**: none automated (this audit was manual).

## 7. Missing production monitoring

Real, minimal foundation shipped this pass: structured JSON logging
(`api/_lib/log.js`) on admin-login attempts, order status writes, and
payment confirmations, captured by Vercel's built-in function logs. What
is genuinely still missing, and requires accounts/credentials this
project does not have:

- No error-reporting service (Sentry or equivalent) — client-side
  exceptions and unhandled API errors are not aggregated anywhere.
- No uptime/synthetic monitoring.
- No dashboards or alerting on the new structured logs (they're
  queryable in Vercel's log viewer, but nothing pages anyone).
- No distributed tracing across the multi-step order lifecycle.
- No fraud-monitoring system — `tenderHaptics.fraudAlert()` exists as a
  UI signal, but there is no backend fraud-detection logic that would
  ever trigger it.

## 8. Missing documentation

- No runbook for what an operator does when Redis/Blob is unreachable,
  or when a payment-reference conflict (the new 409 response) shows up
  in the logs.
- No documented incident-response process for a suspected compromised
  admin session.
- `README.md`/`SUBMISSION_LOG.md` describe the product; neither describes
  the security model, which now genuinely needs describing given how
  much of it changed this pass.
- This report and `docs/DESIGN_SYSTEM.md` are themselves the main
  technical documentation the project has; there is no separate API
  reference or architecture diagram.

## 9. Probability of World App approval

**Moderate — meaningfully improved from the ~85–90% rejection estimate at
the start of this project, but not low.** Every specific defect the
original review flagged (hardcoded credentials, generic UI, no server-side
admin authorization) is now fixed. What still stands between here and a
confident "yes":

- The `GET /api/orders` PII exposure (§1.2) is the kind of finding a
  security-literate reviewer *would* find if they tried — it's one
  `curl` command away, no exploit needed.
- Admin sign-in is non-functional until env vars are set — a reviewer
  testing the admin flow today would hit a dead end.
- Nothing has been confirmed working inside real World App, and MiniKit
  integrations are exactly the category a World reviewer tests most
  directly.

Given that, I'd put current rejection probability in the **25–35% range**
— down substantially, not down to "essentially zero."

## 10. Probability a senior fintech engineering team would approve this for production

**Lower than the World App number, and it should be.** A fintech
engineering review holds a stricter bar than a marketplace listing
review, specifically on the items this report is most honest about:

- No session-token model for regular users is very likely a hold in
  itself at most fintech shops — "the server trusts a client-declared
  user ID" is a first-week finding in that kind of review.
- Zero automated coverage of the actual money-movement flows (§6) would
  be flagged immediately — pricing-math unit tests are good, but they are
  not evidence the buy/sell/settle flow works end-to-end.
- No error tracking / fraud monitoring in production (§7) is a real gap
  for something "holding real money," per the brief's own framing.

I'd estimate **10–20%** as-is — not because the work done this pass isn't
real (it is, and each fix above is independently verifiable), but because
"holds real money" implies a bar this codebase's session model doesn't
yet clear, and no amount of UI/UX polish changes that verdict.

---

## Release checklist

Nothing below is hidden or assumed done. `✅` = verified this pass. `⬜` =
open, with the section it's detailed in.

- ✅ No hardcoded credentials in source, bundle, or docs
- ✅ Admin-only status writes enforced server-side, not just client UI
- ✅ Payment-reference replay/duplicate-submission blocked server-side
- ✅ Rate limiting on the credential-checking endpoint
- ✅ CSRF Origin validation (partial — see §2 for the SameSite root cause)
- ✅ Input validation bounds on the shared order-write endpoint
- ✅ Dependency vulnerabilities resolved (0 remaining per `npm audit`)
- ✅ WCAG AA contrast verified and fixed where it failed
- ✅ Global keyboard focus indicator
- ✅ Global reduced-motion compliance
- ✅ Structured logging on financial/security events
- ✅ 28 automated tests passing, zero build errors
- ⬜ `ADMIN_PHONE`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET` set in Vercel (§1.1)
- ⬜ `GET /api/orders` per-user authentication (§1.2 — architectural)
- ⬜ CORS wildcard tightened *and tested inside real World App* (§1.3)
- ⬜ Any verification inside actual World App on a real device (§3)
- ⬜ Payment-flow / integration / E2E test coverage (§6)
- ⬜ Error reporting + fraud monitoring wired to a real service (§7)
- ⬜ Profile rebuilt to match the rest of the design system (§4)
- ⬜ Security-model documentation (§8)
