# TCash — Certification Report

This is the closing pass over `PRODUCTION_READINESS_REPORT.md`,
`LAUNCH_REPORT.md`, `RELEASE_REPORT.md`, `VALIDATION_REPORT.md`, and
`EXPERIENCE_COMPLETION_REPORT.md`. It does not repeat their findings —
it re-verifies what could actually be re-verified this pass (production
behavior, code, automated tests, DOM inspection) and is explicit,
per-item, about what still can't be verified from here (real-device
World App behavior). Every claim below is tagged with how it was
verified. Untagged claims don't appear in this report.

## 0. What changed this pass

- **Deployed the architecture work that sat uncommitted since the last
  report.** Commit `69a2337` (session/ownership architecture, Profile
  rebuild, AmountField, 56 tests) is now live in production
  (`dpl_7eWw1S3czqLf1n9C4KKqp8mwGJJY`, READY). This mattered because
  every prior report's confidence numbers were partly contingent on
  code that existed but wasn't running anywhere real.
- **Icon system**: redrew `sun`, `moon`, `clock`, `close`, `logout`,
  `gift` — the six icons in `Icon.jsx` whose path data was confirmed
  (by direct comparison against Feather/Lucide source coordinates) to
  be identical or trivially-retuned defaults. Added two new bespoke
  icons (`mail`, `chat`) to close the "email/WhatsApp both show a phone
  glyph" gap the last report flagged. See §2 for the correction to that
  report's icon-status claims.
- **Support and Guidelines rebuilt** from the pre-Tender boxed-card
  language (`.panel`, `.profile-hero`, `.help-guide-card`) into the
  same hairline ledger-row grammar as Home/Wallet/Profile. `.profile-
  hero` specifically still carried the literal dark-navy/blue-gold
  gradient the entire Tender redesign replaced everywhere else — this
  was a real, concrete cohesion break, not a subjective one.
- **~180 lines of now-orphaned CSS removed** (`.profile-hero`,
  `.profile-link-card`, `.profile-stats-list`, `.profile-stat-row`,
  the `.help-guide-*` family) after confirming via full-repo grep that
  nothing still referenced them. Production CSS bundle: 121.59kB →
  118.74kB gzipped-source (measured, not estimated).

## 1. Design cohesion review — Wallet, Support, Guidelines, Admin

| Screen | Finding | Verified by |
|---|---|---|
| **Wallet** | Already fully in the Tender ledger language (`.tdr-home`, `.tdr-ledger-row`, `.tdr-wallet-vault`) — deployment history shows a dedicated Wallet-redesign commit. **`EXPERIENCE_COMPLETION_REPORT.md`'s claim that Wallet was "still pre-Tender legacy CSS" was stale/incorrect**, not a live finding. No rebuild performed because none was needed. | Code read |
| **Support** | Was genuinely below the bar — boxed `.panel`/`.profile-hero` cards, including the literal old navy-gradient hero. Rebuilt this pass into `.tdr-home-section`/`.tdr-ledger-row`, including converting the FAQ accordion's "+/−" text glyphs to the `arrowUp`/`arrowDown` icons and adding dedicated `mail`/`chat` icons. | Code read, build, DOM verification |
| **Guidelines** | Same finding as Support, same fix. All 7 rule sections and the legal-links section rebuilt into ledger-row records. | Code read, build, DOM verification |
| **Admin** | Uses generic utility classes (`.field`, `.stack`, `.button`, `.brand-kicker`, `.info-grid`) that are globally token-driven, not the specific dark-glass hero pattern Support/Guidelines had. **Deliberately not rebuilt this pass**: it's gated behind admin recognition, essentially unreachable by a World App consumer reviewer evaluating the trading experience, and a full ledger-grammar rebuild of a 694-line operator console is a large, high-risk change for near-zero reviewer-facing benefit relative to its cost. This is a documented decision, not an oversight — flagged as remaining design debt below. | Code read |

## 2. Icon system

**Corrected finding**: on direct path-coordinate comparison against
Feather/Lucide source, `home`, `wallet`, `bell`, `phone`, `history`,
and `refresh` were already bespoke redraws (custom arc math, a wallet
clasp dot, a device-style phone instead of Feather's handset) from
earlier work — the prior report's list of "still generic" icons was
inaccurate for these six. The genuinely unmodified-or-trivially-retuned
ones were `sun`, `moon`, `clock`, `close`, `logout`, `gift` — all six
redrawn this pass into the detached-tick/filled-seal/flag-tip grammar
already established by `bridge` and `check`. `mail` and `chat` added
as new bespoke glyphs, closing the email/WhatsApp icon-reuse gap.

**Status: no remaining Feather/Lucide-identical icon in `Icon.jsx`.**
Verified by direct coordinate comparison against upstream Feather/
Lucide path data (not a visual guess) for all 20 entries in `PATHS`,
and by DOM inspection confirming every redrawn icon renders visibly
(nonzero bounding box, correct `d` attribute) on Home, Profile, and
Support. — *Verified in code + verified by DOM inspection.*

## 3. World App validation plan

`ON_DEVICE_TEST_SCRIPT.md` (25 items across 5 parts) already covers
every category this turn's brief asks for: MiniKit lifecycle and
wallet connection (Part 1), payment flows (Part 2), background/
foreground and payment-sheet interruptions, force-quit, and offline
recovery (Part 3), device conditions including dark mode and TalkBack
(Part 4), and session/replay attack surface (Part 5). Deep linking and
haptics are explicitly items in Part 1. Navigation-state restoration
after interruption is the specific question asked in every Part 3
item ("does TCash recover to a sane, honest state").

**No new document was written**, because the existing one already has
the right shape — writing a second, overlapping checklist would be
busywork, not progress. What changed instead: this report explicitly
confirms the coverage above by re-reading the existing script against
the current brief's checklist, item by item.

**The gap is unchanged and is the single largest source of uncertainty
in this entire project**: the script has still not been run on a real
device. Nothing in this report claims otherwise. — *Awaiting real-
device verification.*

## 4. Security certification

Every item below was re-checked against **production**, not code, this
pass:

| Check | Result | Verified by |
|---|---|---|
| `GET /api/orders`, no session | **401** "Sign in to view orders." | Live `fetch()` against `world-t-mpesa.vercel.app` |
| `POST /api/orders`, no session | **400**, rejected before reaching write logic | Live `fetch()` |
| `POST /api/admin-login` | **503** "Admin sign-in is not configured on this deployment yet." | Live `fetch()` |
| Deployment matches latest commit | `dpl_7eWw1S3czqLf1n9C4KKqp8mwGJJY`, commit `69a2337`, state `READY`, aliased to production | Vercel deployment API |

The critical finding from `VALIDATION_REPORT.md` — production
returning all 54 orders unauthenticated — **is fixed and confirmed
fixed in the running deployment**, not just in source. The
admin-login 503 is expected and unchanged: `ADMIN_PHONE`/
`ADMIN_PASSWORD` remain unset in the Vercel environment, which is a
config/ops task outside this session's access, not a code defect.

**Not re-verified this pass** (unchanged from `RELEASE_REPORT.md`,
no new evidence either way): rate-limit behavior under sustained
attack, CSRF Origin-check behavior from an actual World App WebView
(its exact Origin/Referer behavior is still undocumented — see
`api/_lib/csrf.js`'s permissive-when-absent tradeoff), and whether the
SIWE session cookie survives a real World App backgrounding cycle.
— *Verified in production (auth/ownership); verified in code
(rate-limit/CSRF logic exists); awaiting real-device verification
(WebView-specific header behavior).*

## 5. Performance certification

Real numbers from this pass's production build, not estimates:

| Metric | Value | Verified by |
|---|---|---|
| Total JS (gzipped) | ~192kB across all route chunks + `world-sdk` | Build output |
| Largest chunk | `world-sdk-*.js`, 367.72kB raw / 108.55kB gzip | Build output |
| Second largest | `router-*.js`, 163.21kB raw / 53.67kB gzip | Build output |
| CSS bundle | 118.74kB gzip source (was 121.59kB before this pass's dead-code removal) | Build output, before/after |
| Route chunks (each page) | 2.3kB–21.7kB raw, individually code-split | Build output |
| Test suite runtime | 56 tests, 2.20s total | `vitest run` |

`world-sdk` (MiniKit) is the dominant cost and isn't something this
project controls — it's the official SDK. Route-level code-splitting
is already in place (each page is its own chunk), so the optimization
available here is already applied; there's no measured evidence that
further splitting would move a real metric.

**Not measured this pass, and not claimable as certified**: actual
device startup time, First Contentful Paint, animation frame timing,
and memory usage. These require a real device or a Lighthouse-style
runtime trace against a live session; static bundle analysis is a
proxy for load cost, not a substitute for the measurement. No score
in this report treats bundle size as a stand-in for a timing metric.
— *Verified in code (bundle composition); awaiting real-device or
runtime-trace verification (timing metrics).*

## 6. Accessibility re-certification

Re-checked directly, not cited from a prior pass:

| Check | Result | Verified by |
|---|---|---|
| Bottom nav touch targets | 66px tall (Home/Wallet/History), 66×84px (Trade) — all well above the 44×44 WCAG minimum | DOM `getBoundingClientRect()` |
| Ledger-row touch targets (Support, Guidelines, Profile) | 71px tall | DOM `getBoundingClientRect()` |
| `prefers-reduced-motion` coverage | Present and active in the stylesheet | `document.styleSheets` inspection |
| New icons' color | All use `currentColor`, inheriting from the same text/muted tokens already contrast-audited in the prior WCAG pass (5.05:1 / 5.47:1 light-mode) — no new color introduced | Code read |
| Accordion (Support) keyboard/AT semantics | `aria-expanded` correctly toggles true/false per button, verified via direct event dispatch, not just visual state | DOM interaction test |

**Unchanged from the last pass, still unverified**: dynamic OS
text-scaling under large font sizes has never been visually confirmed
not to clip (relative units are used throughout, which is a reasonable
basis for confidence, but "reasonable basis" isn't "verified").
TalkBack/VoiceOver navigation has never been tested by a screen reader,
only inferred from `aria-*` attributes being present and correct in
markup. — *Verified in code + DOM (touch targets, reduced-motion,
contrast, ARIA state); awaiting real-device verification (text-scaling
render, actual screen-reader navigation).*

## 7. Financial experience review

Reviewed the Buy flow end-to-end in code (`BuyPage.jsx`,
`useOrderFlow.js`, `Receipt.jsx`, `HoldToConfirm.jsx`):

- **Confirmation before commitment**: amount entry → order creation
  requires an explicit "Confirm buy order" tap; the final payment
  submission requires a sustained hold (`HoldToConfirm`), not a tap —
  correctly asymmetric, since creating a KES-denominated order is
  reversible (no funds moved yet) but submitting a payment reference is
  the point of no return.
- **Failure surfacing**: `markAsPaid` (in `useOrderFlow.js`) wraps
  `commitPaidOrder` in try/catch and re-throws on server-rejected
  409/403 (duplicate payment reference, ownership mismatch) instead of
  silently proceeding to a false-success receipt — this was a real bug
  fixed earlier this project and is confirmed still in place in the
  current source.
- **Receipt correctness**: the receipt reads directly from
  `currentOrder` (server-confirmed state), not from optimistic local
  state, for the amount, asset, and reference number shown.
- **Loading state**: "Placing order…" replaces the button label and
  the button disables during the async call — no double-submit path
  visible in the code (button `disabled={orderCreating}`).

**Not verified this pass**: whether these states render with correct
timing/feel on a real device under real network latency — this is a
code-correctness review, not a felt-experience review, and the two are
not the same claim. — *Verified in code; awaiting real-device
verification (felt timing/latency).*

## 8. World App review simulation

Six reviewer personas, each trying specifically to find a rejection
reason — not a generic walkthrough:

1. **The compliance reviewer** (checks for money-services-adjacent
   red flags): Looks for guaranteed-return language, hidden fees,
   unclear risk disclosure. **Finds nothing to reject on** — Guidelines
   now explicitly states "Manual service," "No guarantees," and
   itemized limits, and this was true before this pass too.
2. **The impersonation checker** (looks for copied UI/brand
   assets from Coinbase/Binance/etc.): **Finds nothing** — the Tender
   design language is deliberately non-generic, and this pass's icon
   redraws removed the last literally-Feather-identical assets, which
   is exactly the category of thing this reviewer type flags.
3. **The broken-state hunter** (mashes buttons, double-taps,
   backgrounds the app mid-flow): **Cannot be fully simulated from
   here** — this persona's most important tests are exactly the Part 3
   interruption scenarios in `ON_DEVICE_TEST_SCRIPT.md` that remain
   unrun. This is the persona most likely to find something this report
   can't rule out.
4. **The permissions auditor** (checks whether the app asks for more
   than it needs, at the right time): Notification permission is
   requested from an explicit in-Profile button, not on load — correct
   pattern. **No finding.**
5. **The "does this even work" reviewer** (the baseline: does Buy
   and Sell actually complete): Code path is complete and the receipt
   flow is real, but this reviewer's actual test is a live transaction
   in real World App, which — per this project's standing rule — cannot
   be claimed as passed without having been observed. **Cannot be
   certified from here; this is the highest-stakes unresolved item.**
6. **The design-consistency nitpicker** (flags screens that feel
   like a different app): Was previously most likely to flag
   Support/Guidelines' leftover dark-glass hero card — that specific
   objection is now closed. Admin remains a plausible (lower-severity)
   target for this persona, documented above as a known, deliberate gap.

## 9. Final certification report

**1. Critical issues** — *(none currently identified against the
   deployed code; the previous Critical — unauthenticated order access
   — is confirmed fixed in production, §4)*

**2. High issues**
- Zero on-device World App verification exists anywhere in this
  project's history. `ON_DEVICE_TEST_SCRIPT.md` is ready; it has not
  been run. *(Awaiting real-device verification)*
- WebView-specific CSRF/Origin-header behavior is undocumented —
  `api/_lib/csrf.js`'s permissive-when-header-absent fallback is a
  guess about World App's WebView, not a confirmed behavior.
  *(Awaiting real-device verification)*

**3. Medium issues**
- Admin console (694 lines) not structurally rebuilt into the Tender
  ledger grammar — deliberate deprioritization given near-zero
  reviewer exposure, but it is real, visible inconsistency for anyone
  (including the operator) who does see it. *(Verified in code)*
- `.market-token-card`/`.wallet-asset-card`/`.growth-center-card`/
  `.feature-story-*`/`.quick-action-grid`/`.market-board-grid` CSS
  (pre-existing, unrelated to this pass) has zero JSX usage anywhere in
  `src/` — dead code from an earlier, since-removed "market/discovery"
  feature, discovered while cleaning up this pass's own orphaned
  classes but out of scope to remove today. *(Verified in code)*

**4. Cosmetic issues**
- True pixel-level visual QA (kerning, exact alignment) remains
  unverifiable this session — screenshot capture has timed out on
  every attempt across this project's entire history, including this
  pass. All visual claims in this report are DOM/computed-style-based,
  not eyes-on-render-based. *(Awaiting tooling / real-device
  verification)*

**5. World App risks**
- The interruption-recovery category (Part 3 of the test script) is
  the single highest-probability source of an actual rejection —
  it's the one class of bug that genuinely cannot be found by code
  review, and it has never been tested.
- Admin-login's 503 (env vars unset) is expected, not a defect, but
  is worth an explicit operational note: if a reviewer somehow reaches
  `/tmpesa-admin` and tries the phone/password path, it will visibly
  fail. The primary admin path (World App identity) is unaffected.

**6. Technical debt**
- Dead CSS from a removed "market/discovery" feature (§3 above),
  scoped but not removed.
- `AmountField`'s append/backspace-only cursor model (documented,
  unchanged from last pass).

**7. Design inconsistencies**
- Admin console vs. the rest of the app (documented above, deliberate,
  not silent).

**8. Performance opportunities**
- None identified that measurement justifies acting on — `world-sdk`
  dominates bundle size and isn't controllable; route splitting is
  already applied. No claim of a specific optimization to make.

**9. Craftsmanship score: 78/100**
*(up from 70/100)* — Support and Guidelines closing the gap to
Home/Wallet/Profile's grammar, the icon system's last real gaps
closed, and ~180 lines of dead CSS removed are the concrete gains.
Held below 80+ by: Admin's deliberate non-rebuild, and the unchanged
fact that no visual claim in this report's history has ever been
confirmed by an actual rendered screenshot.

**10. Production readiness score: 72/100**
*(up from 58/100)* — the single largest jump in this project's
scoring history, because the single largest blocker (uncommitted,
undeployed security work) is now closed and production-verified, not
just code-complete. Held below 80+ specifically by the unresolved
on-device gap (§3, §8) — that gap is what stands between this number
and a much higher one, and it is a testing action, not more
engineering.

**11. World App approval confidence: ~62%**
*(up from ~55%)* — movement is justified specifically by production
now matching the security posture that was previously only
code-complete, plus the removal of the last generic-icon and
generic-hero-card artifacts a design-consistency reviewer would
plausibly flag. Not pushed higher, because the largest single
uncertainty — real device behavior under interruption — is completely
unchanged and this pass did not, and could not, touch it.
