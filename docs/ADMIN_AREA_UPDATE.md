# TCash — Admin Area Update

Scoped strictly to admin, per instruction. Closes the single biggest,
most-repeated gap from every prior report this session: fee/settings/
referral-claim admin actions were `localStorage`-only, meaning "Save"
in the Admin Console never affected real users — only the admin's own
browser. That gap is now closed for two of the three affected features.
The third (why it's *not* closed, and shouldn't be rushed) is explained
below.

**Tag legend**: 🧪 automated test · 📄 source code · 🖥️ browser/dev
preview (with the local limitation that `/api/*` isn't served by the
dev server — see verification notes) · ❓ unknown, requires a real
deployment to observe end-to-end.

## What changed

### 1. Operational settings (fees, PayBill, sell wallet) — now shared

**New `api/settings.js`**: `GET` is public and unauthenticated (every
user's Buy/Sell quote depends on these live figures, same as the
public market rate) and returns the shared document from Upstash
Redis. `POST` is admin-only — `requestIsRecognizedAdmin` gate, CSRF
origin check, and every write produces a `logAdminAction` audit record
(`settings.update`, success or failed, with the fields changed) —
exactly the same posture `api/orders.js` already has for order status
writes. Only a fixed allowlist of known fields is ever accepted;
nothing else in the payload reaches the shared document. 📄🧪

**`settingsService.js`**: `updateFeeKesPerCoin` and
`updateOperationalSettings` now push to the shared endpoint *first*,
and only write to local storage on confirmed success. This is a
deliberately different pattern from how orders sync (local-first,
tolerant of transient failure) — there's no responsiveness reason to
be optimistic about a settings save, and being optimistic here would
risk the exact "silent lie" bug class this project has already found
and fixed twice (the admin's own browser showing a "saved" fee that
never actually reached anyone else). A rejected or failed push now
throws before touching local state. 📄

**New `refreshSharedSettings()`**, called once on every app boot
(`main.jsx`): every user's session — not just the admin's — now pulls
the latest shared settings on load. This is the other half of the fix:
writing to a shared store is meaningless if nothing ever reads it back.
Tolerant of failure (an unreachable server or unconfigured Redis must
never block the app from rendering). `useAppSettings()` needed no
changes — it already subscribes to the same update event this refresh
emits. 📄🖥️

**`AdminPage.jsx`**: both save handlers are now properly async, with a
`Saving…` disabled state (previously a save could be triggered
repeatedly with no feedback) and the success message now says "every
user now sees this" instead of "updated successfully" — accurate to
what actually happens now, not a smaller claim than what's true.

### 2. Referral claims — now shared, ownership-enforced

**New `api/referral-claims.js`**, mirroring `api/orders.js`'s exact
pattern: `GET` is admin-only (claims carry a payout phone number —
sensitive, same posture as order data). `POST` does double duty by
design, same as how orders distinguish a draft from a status change:
if the claim ID doesn't exist yet in the shared store, it's a new
claim (any authenticated user may create one, but only for their own
wallet — enforced server-side, same `ownership` check style as
`orderBelongsToWallet`); if it already exists, it's a status change
(approve / mark paid), and that requires a recognized admin, a trusted
origin, and produces an audit record. 📄🧪

**`referralService.js`**: `createReferralClaim` now also carries
`referrerWalletAddress` (needed for the new ownership check) and syncs
to the shared store — tolerant of a transient failure the same way
`commitPaidOrder` is, but a server-explicit rejection (wrong wallet)
surfaces rather than being swallowed. `updateReferralClaim` — the
actual money-moving admin action — pushes to the shared store first,
same reasoning as settings. New `fetchSharedReferralClaimQueue()`
mirrors `fetchSharedAdminOrders()` exactly.

**`AdminPage.jsx`**: the referral queue now loads from the shared
backend (real claims from real users, not just ones created in the
admin's own browser history), and both "Mark Approved"/"Mark Paid"
buttons show a per-claim `Saving…` state and surface a real error
(with the referrer's own username in the message) if the update is
rejected — there's no optimistic local write to roll back here, since
the write is server-first, so there's nothing stale left behind on
failure.

## What did NOT change, and why

**The deeper "who are your referred users" calculation
(`getReferredUsers`, `getReferralTradingSummary` in
`referralService.js`) is still entirely local-storage-scoped.** This
surfaced while investigating the claims gap: there is no server-side
user directory anywhere in this codebase — `getUsers()` only ever
returns users who have signed into *this specific browser*. A
referrer's "6 referred users" count is only accurate if their own
browser happens to have also seen those users sign up, which will
essentially never be true across real, separate devices. This is a
real, pre-existing limitation, deeper and larger than "the admin
console's settings don't persist" — fixing it means building an actual
server-side user directory (a new identity/data-model feature, not an
admin-scoped fix), which is why it wasn't attempted here. Flagging it
plainly rather than either quietly leaving it undocumented or
attempting a rushed, risky fix under a "strictly admin" instruction
that didn't ask for a new user-identity system.

**Admin console's visual language** still doesn't match the ledger
grammar used elsewhere (generic `.field`/`.panel`/`.button` utility
classes) — unchanged this pass; the instruction was interpreted as
"close the biggest functional gap," and a visual-only pass would have
been a materially smaller use of a "strictly admin" turn than actually
making the console's core actions work for real.

## Verification

- 🧪 80/80 automated tests passing (was 59 before this pass) — 21 new
  tests covering `sanitizeSettingsPayload`/`isValidFee`/`isBoundedString`
  (settings) and `isClaimRecord`/`normalizeWallet` (referral claims),
  matching this codebase's established convention of testing exported
  validation logic rather than mocking the full Redis-backed HTTP
  handler (the same pattern `api/orders.test.js` already uses).
- 🖥️ Build clean. App verified in-browser to render correctly and
  degrade gracefully when `/api/settings` and `/api/referral-claims`
  are unreachable (the local dev server doesn't serve `/api/*` routes
  — an established limitation this whole project, not new to this
  pass) — confirms the failure-tolerant paths actually work, not just
  the happy path.
- ❓ **Not verified**: the actual authenticated admin flow (saving a
  real fee change and confirming a second session picks it up) — this
  requires either a deployed preview or a mocked admin session neither
  of which this pass had. This is the one thing that genuinely needs a
  real deployment to confirm end-to-end, and this report says so
  rather than assuming the code is correct because it type-checks and
  builds.

## Status

Uncommitted. This turn's instruction was to work on the admin area,
not to ship it — held pending rather than pushed automatically, same
as this project's standing default.
