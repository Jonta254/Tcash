# TCash — Launch Readiness Report

This builds directly on [`PRODUCTION_READINESS_REPORT.md`](PRODUCTION_READINESS_REPORT.md)
from the previous audit — it is not re-derived from scratch, and the two
should be read together. This pass's real, verified additions:

- **Two silent-failure bugs found and fixed** — both are exactly the
  "every irreversible action must communicate certainty" failure mode
  this brief asked for, not cosmetic:
  1. `AdminPage.jsx`'s status-update flow wrote the new status to local
     storage *before* confirming the server accepted it, and never rolled
     back on failure — an expired admin session would show "Completed"
     in the admin's own browser while the shared record still said
     "Paid." Fixed: rollback on failure, haptic now fires only on
     confirmed success, not on optimistic intent.
  2. `commitPaidOrder` swallowed *every* sync failure, including the
     409 duplicate-payment-reference rejection added last pass — meaning
     a blocked replay attempt (or a legitimate collision) would still
     show the user a success receipt for an order the admin would never
     see. Fixed: the client now distinguishes a transient failure (safe
     to swallow, backfill retries) from a server-explicit rejection
     (surfaced immediately, receipt blocked) via the HTTP status code.
- **Offline detection added** (`useOnlineStatus.js` + a shell-level
  banner) — there was none before; every network failure looked
  identical whether the phone had no signal or the server was down.
- **Real performance audit performed** (not asserted) — see §5.
- **7.4MB of `public/`, much of it orphaned** — see §5.

---

## 1. Remaining release blockers

Unchanged from the previous report, restated because they're still true:

1. `ADMIN_PHONE`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET` not set in Vercel.
2. `GET /api/orders` has no authentication — still the single biggest
   open item in this codebase, still architectural, still not
   partially-patched this pass for the same reason as last time (a wrong
   partial fix breaks legitimate multi-device sync worse than a
   documented gap).
3. Nothing verified inside real World App.

## 2. Remaining security blockers

Re-classified with severity and the **minimum safe fix** for each —
not the ideal fix, the smallest change that actually closes the gap.

| Finding | Class | Minimum safe fix |
|---|---|---|
| `GET /api/orders` returns all users' PII to any caller | **Release blocker** | Issue a signed session token after SIWE verification (`api/complete-siwe.js` already does the verification — it just doesn't hand back anything the client can present on later requests); filter `GET /api/orders` server-side by the token's wallet address instead of trusting a client-supplied `userId` |
| Admin sign-in inert without env vars | **Release blocker** (until set) | Set the three env vars in Vercel. Nothing else required — the code already handles it correctly once configured |
| `Access-Control-Allow-Origin: *` amplifies the above to browser-JS attackers | **High** | Change to the deployment's real origin in `vercel.json`, verified inside real World App first (flagged, not fixed, both passes, for the same reason) |
| No session-token model for regular users | **High** | Same fix as the `GET /api/orders` item — this is the root cause, that's the symptom |
| Interrupted-payment recovery doesn't exist | **Medium** | See §7 — needs on-device behavior knowledge this project doesn't have before designing the fix |
| CSP header absent | **Low-Medium** | Needs a dedicated pass with real testing, not a guessed directive list |
| Small icon-buttons under 44×44 (still ≥24×24, so not an AA failure) | **Low** | Cosmetic; not blocking |

Nothing on this list is hidden. The two release blockers are the same two
named in the previous report — this pass did not close them, and says so
rather than reframing them as smaller than they are.

## 3. Remaining UX weaknesses

- Profile is still the one screen that doesn't match the rest of the
  system — stat rows, not the ledger/identity language everywhere else.
- Gesture amount entry (Buy/Sell step 1) is still a plain number input.
- The offline banner added this pass is new and unverified in the one
  place that matters most — a real WebView losing and regaining a
  cellular connection, not a browser tab's `navigator.onLine` event
  (which is what it's actually built on, and which is known to be
  unreliable on some mobile browsers/WebViews for detecting a slow or
  degraded connection, only a fully absent one).

## 4. Remaining technical debt

Unchanged from the previous report: the client-declared-userId session
model, `api/orders.js`'s single 500+-line file doing five jobs, two
parallel order stores (Redis/Blob) doubling the surface for a
path-specific bug, dead legacy CSS in not-yet-rebuilt screens.

## 5. Remaining performance opportunities

Actually measured, not guessed:

- **`@worldcoin/minikit-js` (the "world-sdk" chunk) blocks first paint
  of every screen, including Login.** `SafeMiniKitProvider` wraps the
  entire app above the router with a static import — Vite correctly
  splits it into its own 367KB (108KB gzip) chunk for caching, but the
  browser still has to fetch, parse, and execute that whole chunk before
  *any* route can mount, even though a first-time visitor looking at the
  Login screen doesn't need wallet/payment capability yet. This is the
  single largest real performance lever in the app. **Not fixed this
  pass**: deferring MiniKit initialization (dynamic import + Suspense
  boundary around just the provider) risks changing the timing
  assumptions the wallet-auth and World Pay flows may depend on, and
  this project has no way to verify that timing on a real device. Flagged
  with a specific, actionable next step rather than left vague.
- **7.4MB in `public/`, and a meaningful fraction of it is dead weight**:
  `portal-showcase-1-v2.png` / `-v3.png`, `portal-hero-v3.jpg` / `-v4.jpg`,
  `portal-logo-v3.png` / `-v4.png`, and several more — versioned
  iterations of the same World Developer Portal marketing images, with
  zero references anywhere in `src/` or `index.html` (verified by grep,
  not assumed). These don't slow down the *app* — unreferenced public
  files aren't fetched by a client — but they bloat every deploy and the
  repo itself. **Not deleted this pass**: only the project owner knows
  which version was actually the one submitted to the Developer Portal;
  guessing wrong and deleting the real one would be worse than leaving
  the clutter documented.
- Route-level code splitting is already correctly in place
  (`React.lazy` per page in `AppRoutes.jsx`) — a real strength, not a gap.
- Fonts are the platform system stack (`-apple-system`/Roboto) — zero
  font-loading cost, already optimal, nothing to fix.
- No evidence of unnecessary re-render storms in the hot-path screens —
  state is scoped locally per component, no global store re-rendering
  the whole tree on every tick.

## 6. Remaining accessibility issues

From the previous pass, still open: several icon-buttons under the
44×44 comfort guideline (not a WCAG failure, a polish item); dynamic
text-scaling under heavy OS font-size increases hasn't been tested
against layouts (relative units are used throughout, which should
degrade gracefully, but "should" isn't "verified"). No new accessibility
work happened this pass — the last pass's fixes (contrast, focus
indicator, reduced motion) hold, nothing regressed (build + 28 tests
verified green after every change this session).

## 7. Remaining World App risks

The two silent-failure bugs fixed this pass (§ above) were both found by
reading the code for exactly this brief's "certainty/accountability"
requirement — that method surfaced real bugs, which is itself evidence
that a from-scratch audit is still finding things, not just re-confirming
old findings. One risk this pass surfaced but could not resolve:

- **Interrupted payment recovery does not exist.** If a user starts a
  World Pay send (`SellPage.jsx`'s `handleMiniAppSend`) and World App's
  native payment sheet causes the WebView to reload or lose its JS
  execution context before the `pay` command's result callback fires,
  the in-memory `currentOrder`/`step` state is gone — and because the
  order is only written to storage *after* a successful result comes
  back, it's possible for crypto to leave a user's wallet with TCash
  holding zero record of the attempt. This project cannot verify whether
  World App's WebView actually behaves this way (reload-on-native-sheet
  is a known pattern in some mobile WebView integrations, not confirmed
  here) — it's flagged as a real, unverified risk rather than either
  fixed blind or ignored.
- Everything from the previous report's §3 stands: wallet connection,
  `pay`, haptics, deep links, and lifecycle/reconnect are all still
  unverified on a physical device.

## Design comparison (Revolut / Coinbase / Cash App / Stripe / Apple Wallet)

Kept short because this is a qualitative check, not a measurable audit —
padding it out would be performance, not honesty.

**Where TCash holds up**: the serif-balance/Bridge-motif/stamp-mark
identity is genuinely distinctive against all five — none of them would
be mistaken for TCash from a cropped screenshot, which was the explicit
goal several passes ago and is still true.

**What still feels less intentional next to them**: Cash App and Apple
Wallet both make the *one* thing you can do on a screen physically
obvious within a glance — TCash's Home does this well (the Buy/Sell
split), but Profile does not (it's a list of settings sections with no
visual hierarchy telling you which one matters). Stripe's dashboard
communicates system state (webhook delivered, payment captured) with
much tighter, more specific micro-copy than TCash's still-somewhat-generic
error strings ("Tcash could not sync orders to admin" reads as software
talking about itself, not as a specific, actionable fact). Revolut's
error states always tell you the *next* action, not just what failed;
TCash's newly-added offline banner does this ("will reconnect
automatically"), but older error messages elsewhere in the app mostly
don't.

## World review simulation

**As a World App reviewer**: the specific things I'd have rejected on
sight in the original review (hardcoded credentials, templated success
screens, no server-side admin auth) are gone. What I'd still flag: `GET
/api/orders` returns PII with zero auth — one API call away from finding,
no exploit needed. That alone is enough to hold a fintech-category
listing.

**As a first-time user**: the Login screen and Home balance are the most
confidence-inspiring 10 seconds in the app — the serif figure, the Bridge
strip, nothing feels generated. The M-Pesa payment step (typing in a
code, trusting it'll be checked) is the one moment that still asks for
faith rather than earning it visually — there's no indication *why* this
is safe, just an instruction to do it.

**As a returning customer**: the ledger-reveal History and the receipt
artifact are the two things I'd remember and expect again — they're the
parts of the app that feel like *records*, not screens. Profile is the
one place that would make me wonder if I'd navigated to a different, less
finished app.

**As a fintech engineer**: the session model is the finding I'd lead
with in a review — not because anything else is wrong, but because
everything else being right doesn't matter if the server trusts a
client-declared identity for reading and (partially) writing financial
records.

**As a security engineer**: two real audits, two real fix rounds, real
tests that caught real bugs during this session, a real (if partial)
observability foundation. Also: one unresolved critical finding
(§1/§2), un-set production secrets, and zero on-device verification of
the payment-critical MiniKit flows. Both things are true at once.

**As a product designer**: the identity system (Tender) is the
strongest, most complete piece of this entire project — coherent,
original, and load-bearing rather than decorative. Profile is the
clearest remaining gap, and it's a gap of *finishing*, not of concept —
the system already knows what Profile should look like, it just hasn't
been rebuilt yet.

---

## 8. Final launch recommendation: **Do not launch**

Not "launch to beta." A beta with real users still means real people's
phone numbers, M-Pesa numbers, and wallet addresses are readable by
anyone who finds the endpoint — "beta" doesn't reduce that harm, it just
reduces how many people it happens to. The moment `GET /api/orders` is
fixed (§2, the session-token fix — this is genuinely the one prerequisite,
not a euphemism for "do everything in this report first"), **launch to
beta/limited users** becomes a reasonable, defensible next step, because
at that point the remaining risks (unverified on-device behavior,
incomplete Profile, no interrupted-payment recovery) are real but are the
kind of thing a small, informed beta cohort can reasonably absorb and
help surface. Public launch should wait for at least one round of actual
in-World-App testing on top of that.

## 9. Confidence score: **58/100**

Not a score of effort — a score of "how close is this to the standard
the brief itself set" ("millions of dollars in transactions"). Breakdown
of what's pulling it up and down:

- **+**: real, verified security hardening across two full passes;
  original, coherent, load-bearing design identity; two genuine
  silent-failure bugs found and fixed this pass specifically because the
  audit method was rigorous, not superficial; 28 real passing tests that
  already caught real bugs; computed (not eyeballed) accessibility fixes.
- **−**: one unresolved release-blocking architectural gap (session
  model); zero on-device verification of anything payment-critical;
  automated coverage exists but doesn't reach the actual money-movement
  flows; one screen (Profile) still visibly unfinished relative to the
  rest of the app.

58 reflects "substantially better than a prototype, not yet at the bar
the brief itself named."

## 10. Estimated probability of World App approval: **30%**

Consistent with, not revised upward from, the previous report's 25–35%
range — this pass fixed two real bugs and added real hardening, but
didn't touch the finding most likely to actually cause a rejection
(§1/§2). Movement within the range, not out of it, is the honest read.
