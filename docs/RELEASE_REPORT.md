# TCash — Release Report

This is the fourth security/QA pass on this codebase (see
`PRODUCTION_READINESS_REPORT.md` and `LAUNCH_REPORT.md` for the prior two).
Read together, they show a real trajectory, not a reset each time — this
report exists specifically because the previous two both named the same
unresolved critical finding, and this pass closes it architecturally
rather than deferring it a third time.

## What actually shipped this pass

**The architectural fix, not a patch.** `GET /api/orders` and the
non-admin-status branch of `POST /api/orders` previously trusted
whatever `userId`/`walletAddress` the client claimed in the request body
— meaning any caller, authenticated or not, could read every user's
phone number, wallet address, and order history, and could plausibly
write to an order they didn't own. That's fixed at the root:

- `api/complete-siwe.js` now issues a signed, httpOnly session cookie
  (`api/_lib/userSession.js`) bound to the wallet address it just
  verified via a real SIWE signature — the one thing about a caller the
  server can actually vouch for. No endpoint trusts a client-supplied
  identity field anymore.
- `GET /api/orders` requires either that session (scoped to the caller's
  own orders) or a recognized admin session (sees everything, unchanged
  from the admin desk's actual job). No session, no data — down from
  "no auth, return everything" to "no auth, return nothing."
- `POST /api/orders` enforces the same: a non-admin write must carry a
  session whose wallet matches every order in the batch, or it's
  rejected with a specific "this order does not belong to your wallet"
  error, not a generic failure.
- **A real regression from the previous pass was found and fixed in the
  same motion**: the admin-only-status gate added last time checked
  *only* the phone/password login cookie — but the product's actual
  primary admin path is opening TCash inside World App as the configured
  operator wallet, which never sets that cookie. That path's real admin
  would have been silently rejected by their own server. `requestIsRecognizedAdmin()`
  now recognizes both paths from server-verified state in both cases.
- **49 automated tests pass** (up from 28), and writing them caught two
  more real bugs before they shipped: an ownership check that worked in
  the live request path (because callers happened to always pass an
  already-lowercased wallet) but wasn't actually correct on its own —
  fixed to normalize both sides rather than relying on an unenforced
  caller convention.

---

## 1. Remaining critical blockers

**None in application code that this project can fix from here.** The
one item left in this category is operational, not architectural:

- **`ADMIN_PHONE`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET` still need to
  be set in Vercel.** Everything downstream of that (admin-login,
  session signing, the unified admin check) is correct and tested; it
  simply has nothing to check against until those three values exist in
  the deployment.

## 2. Remaining security risks

| Finding | Class | Status |
|---|---|---|
| Admin env vars unset | Critical (until set) | Operational, one-time |
| `Access-Control-Allow-Origin: *` on `/api/*` | High | Still open — the PII it could have exposed is now behind auth regardless, so this is no longer a data-leak vector on its own, but it's still unnecessarily permissive. Not tightened blind, same reasoning as before: the SIWE cookie's `SameSite=None` suggests a WebView-compatibility reason this project can't verify without a real device |
| Interrupted World Pay recovery doesn't exist | Medium | Unverified whether it's actually reachable — needs on-device behavior knowledge before it can be safely designed |
| No CSP header | Low-Medium | Deliberately not guessed blind |
| Local phone/password login is now fully inert for order sync | Low | Not a vulnerability — the opposite. `loginUser()`'s users have no SIWE-verified session, so they can create local drafts but nothing they submit will sync to the shared queue. This is *correct* given the live LoginPage no longer offers that path at all, but it's now dead code that should be formally removed rather than left half-alive |
| Rate limiting on admin-login is Redis-backed only if Redis is configured | Low | Documented limitation, unchanged from previous report |

**What's now verified clean, specifically because it was tested, not
assumed**: ownership enforcement (6 tests), session forgery/tampering/
expiry resistance (7 tests), the admin-recognition unification across
both real entry paths (5 tests) — see `api/_lib/userSession.test.js`,
`api/_lib/adminAuth.test.js`, `api/orders.test.js`.

## 3. Remaining privacy risks

The headline privacy finding from the last two reports — any caller
could read every user's phone number, M-Pesa number, and wallet address
via `GET /api/orders` — **is fixed**. What's left:

- Structured logs (`api/_lib/log.js`) include wallet addresses and order
  ids in security-event lines by design (that's what makes them useful
  for investigating a real incident) — these live in Vercel's log
  product with whatever retention/access Vercel's own account controls
  provide. No separate PII-handling policy has been written for that.
- No documented data-retention or deletion process for order records
  containing phone numbers and M-Pesa numbers.

## 4. Remaining production risks

- Zero on-device World App verification, still — this is the largest
  single category of residual uncertainty in the entire project, named
  in every report so far, unchanged because it requires access this
  project has never had.
- The GET/POST auth changes this pass are logically verified (49 passing
  tests exercising the real token/ownership code paths) but have never
  been exercised against a live Vercel deployment with real Redis/Blob
  and a real SIWE signature — `vite dev` doesn't run `/api/*` at all, so
  the *integration* of these pieces is untested beyond code review + unit
  tests, only the pieces themselves.
- A currently-logged-in user from before this fix ships has no session
  cookie yet — their next order sync will get a 401 until they
  re-authenticate once. Expected and correct, but worth knowing before
  deploying so it isn't mistaken for a bug.

## 5. Remaining technical debt

Unchanged from the last two reports, restated because still true:
`api/orders.js` does five jobs in one file; two parallel order stores
(Redis/Blob) double the surface for a path-specific bug; Profile is
still visually unfinished relative to the rest of the app (explicitly
out of scope this pass — this brief said improve implementation quality,
not redesign UI, and that instruction was followed). New debt from this
pass: `loginUser`/`signupUser`'s local-auth code path is now provably
dead weight (§2) and should be removed in a dedicated cleanup, not left
as an increasingly-misleading fallback that quietly can't do what its
name implies.

## 6. Remaining World App concerns

Everything named in the last two reports about MiniKit integrations
(wallet connection, `pay`, haptics, deep links, lifecycle/reconnect)
remains unverified on-device — that hasn't changed this pass, because
this pass's scope was server-side authorization, not MiniKit behavior.
One new, specific concern: the session cookie is `SameSite=None`,
`Secure`, `httpOnly`, issued from a same-origin API call the client
already made with `credentials:"include"` — this *should* behave
identically inside World App's WebView to how it behaves in this
project's testing, but "should" is exactly the word this project has
learned not to trust without a device.

## 7. Estimated approval probability

**~55%.** Meaningfully higher than the 25–35%/30% range in the previous
two reports — not because more things were touched, but because the
*specific* finding most likely to fail a security-literate reviewer
(the unauthenticated PII read) is now genuinely closed, tested, and
architecturally sound rather than patched. It isn't higher than that
because the single largest remaining uncertainty — whether any of this
actually behaves correctly inside real World App — is exactly the kind
of thing a World App reviewer is positioned to catch immediately and
this project is not positioned to rule out in advance.

## 8. Exact work required to reach 90%+ approval confidence

In priority order, each one specific and actionable, not a restatement
of "test more":

1. **One real on-device session inside World App.** Sign in, place a buy
   order, place a sell order through World Pay, background and foreground
   the app mid-flow, check that the session persists across a cold
   restart. This single item resolves more open uncertainty than
   anything else on this list, because everything else in this report
   that's still "unverified" becomes either "confirmed fine" or "here's
   the specific bug" once this happens.
2. **Set the three admin env vars in Vercel.** Five minutes, currently
   blocking the admin desk entirely.
3. **Tighten `Access-Control-Allow-Origin`** from `*` to the real
   deployment origin — but only after (1) confirms the WebView doesn't
   depend on the wildcard for some cross-origin quirk this project
   couldn't observe.
4. **Design interrupted-payment recovery** based on what (1) reveals
   about whether the WebView actually reloads during World Pay's native
   sheet — building this blind risks solving a problem that doesn't
   exist the way it's assumed to, or missing the one that does.
5. **Remove the dead local-auth code path** (`loginUser`/`signupUser` and
   the UI remnants, if any) now that the architecture makes its
   limitation concrete rather than theoretical — small, low-risk,
   removes a footgun for a future maintainer.
6. **Add integration-level tests** that exercise `api/orders.js`'s
   handler function directly (mocked `req`/`res`, real Redis/Blob calls
   stubbed) rather than only its pure helper functions — closes the gap
   named in §4 between "the pieces are tested" and "the assembled
   endpoint is tested."
7. **A tested CSP header** — a dedicated pass, not a guessed directive
   list appended to this one.

Items 2, 5, and 6 can happen without any device access, immediately.
Items 1, 3, and 4 cannot be responsibly done any other way — and items
3 and 4 specifically should not be attempted before item 1, because
guessing right about undiagnosed WebView behavior is not meaningfully
different from guessing wrong.

---

**Recommendation on submission**: do not submit until item 1 (real
on-device testing) has happened at least once. Every code-level Critical
finding from this project's entire audit history is now closed — what's
left is the gap between "verified correct in code and by test" and
"verified correct in the one environment that actually matters," and no
further code review from here closes that gap. That's not a reason to
keep auditing; it's a reason to go test it.
