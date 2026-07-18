# TCash — Experience Completion Report

This builds on, and doesn't repeat, the prior reports in this folder —
`DESIGN_SYSTEM.md` (the identity spec), `LAUNCH_REPORT.md` and
`RELEASE_REPORT.md` (security/architecture), `VALIDATION_REPORT.md`
(on-device verification gap). Where this report says something is fine,
it's because this pass specifically re-checked it, not because an
earlier pass said so and this one is taking that on faith.

## What this pass actually built

- **Profile rebuilt completely.** The only tabbed screen in the app —
  three tabs (Overview/Referrals/More) hiding a stat-row settings dump —
  is now one continuous scroll: identity (avatar, name, trust row) →
  reputation → settlement → notifications → security → referrals →
  preferences → support → log out. Every data section reuses
  `.tdr-receipt-line`/`.tdr-ledger-row` — the exact same components a
  receipt and a history entry use — so a user's own profile now reads
  with the same grammar as a transaction record, not a bespoke
  stat-card layout. All prior functionality (payout number editing,
  notification permission, referral claims, theme toggle, rating,
  support links, admin desk link, logout) is intact and was verified
  working after the rewrite, not assumed working.
- **A real bug found and fixed while rebuilding it**: `.tdr-ledger-row`
  had only ever been used on `<Link>` elements. Reusing it on `<button>`
  elements (the referral claim and support rows) would have shown
  default browser button chrome layered over the row's own border —
  fixed at the shared class, so both usages stay correct going forward.
- **Amount entry rebuilt.** `AmountField` keeps the real, accessible
  native input (no custom keypad — reinventing keyboard input risks
  accessibility and reliability regressions this project has no way to
  verify on-device) but gives it hero-scale serif tabular typography,
  live comma-grouping as you type, a light haptic tick per digit, and a
  clear KES/asset suffix. Verified end-to-end in-browser: typed "12345"
  displays as "12,345" while the underlying value that reaches
  `useOrderFlow`'s calculation is the untouched raw number (confirmed
  via the live "You pay / You receive" quote updating correctly).
  `autoFocus` was considered and deliberately left out — it would pop
  the mobile keyboard immediately on screen entry, a timing/viewport
  behavior this project cannot verify feels right without a device.
- **7 new tests** (49 → 56) covering the amount-formatting logic
  specifically, since it's genuinely pure and testable.

## 1. Remaining inconsistencies

| Finding | Class |
|---|---|
| The live production deployment may still be running last-known-vulnerable code — the session/ownership architecture fix from two audits ago was built and tested but its deploy status is unconfirmed as of this report | **Critical** |
| Wallet, Support, Guidelines, and Admin still run on pre-Tender legacy CSS classes (`.panel`, `.hero-card`, boxed cards) — visually reskinned by an early global token change, but never structurally rebuilt into the line-before-block ledger language the way Home/Trade/Orders/Profile now are | **High** |
| Icon set is only partially bespoke — the financial-action family (Bridge, arrows, stamp-check) was hand-redrawn; navigation/utility icons (home, wallet, bell, phone, gift, clock) are still the generic stroke set | **High** |
| Two of Profile's Support rows (email, WhatsApp) both reuse the "phone" icon — no dedicated email/chat glyph exists in the bespoke set yet | **Low** |
| `AmountField`'s cursor model is append/backspace-only, not arbitrary mid-number editing | **Low** |
| Pull-to-refresh (a swipe gesture) doesn't exist anywhere — Home/Wallet use a tap-to-refresh icon instead, a different and simpler interaction than what this turn's brief asked to review | **Medium** |
| True pixel-level visual QA (kerning, exact alignment) is unverifiable this session — screenshot capture has not worked in any turn of this project | **Cosmetic** (unknown, not confirmed) |

## 2. Remaining UX debt

Gesture amount entry stopped short of a fully custom draggable/swipeable
number pad — a deliberate, conservative choice (see above), not an
oversight, but it means the amount-entry "memorable moment" the brief
asked for is real but modest, not maximal. Wallet/Support still show
the older, denser information layout relative to Home/Profile's newer
rhythm.

## 3. Remaining interaction debt

No pull-to-refresh gesture. No swipe-to-dismiss anywhere. Balance
refresh is a spin icon + a value that updates on the next tick — this
is a **documented, intentional** choice (`DESIGN_SYSTEM.md`: "a
statement doesn't animate a number counting up"), restated here so it
isn't mistaken for unfinished work when a reviewer specifically asked
to check for it.

## 4. Remaining design debt

Wallet, Support, Guidelines, Admin need the same structural rebuild
Profile just got — this is the direct, named next item, not a vague
"more polish" placeholder.

## 5. Remaining accessibility debt

Unchanged from the last accessibility pass: icon-buttons under 44×44
(still ≥24×24, not a WCAG failure); dynamic text-scaling under large OS
font sizes uses relative units throughout but has never been visually
confirmed not to clip. Nothing new introduced or found this pass.

## 6. Remaining World App concerns

Unchanged and still the largest category of real uncertainty in this
entire project: zero on-device verification of wallet connection, `pay`,
haptics, deep links, or lifecycle interruptions. `ON_DEVICE_TEST_SCRIPT.md`
is the actual instrument for closing this — it has not been run.

## 7. Overall product craftsmanship score: **70/100**

Real movement from prior state: the two most-repeated named gaps across
four separate reviews (Profile, amount entry) are now closed, plus a
genuine spacing-rhythm audit (41 fixes), a typography-hierarchy audit (4
fixes), and two real bugs caught in the process. Held below 80+ by: four
screens (Wallet/Support/Guidelines/Admin) still structurally
un-rebuilt, an icon set that's half bespoke, and the honest fact that no
pixel-level visual confirmation has happened at any point in this
project's history — every score in this category is a code-review
score, not an eyes-on-the-render score.

## 8. Overall launch readiness: **58/100**

Deliberately lower than the craftsmanship score, because launch
readiness isn't a design question. The code is in its best state yet —
but readiness is gated by whether the last security fix is actually
live in production (unconfirmed) and whether anything has been tested
on a real device (still zero). This score would jump significantly the
moment those two specific, already-identified actions happen — it isn't
gated on more design work.

## 9. Estimated World App approval confidence: **~55%**

Unchanged from `RELEASE_REPORT.md`'s estimate. This pass's work was
UI/UX craftsmanship, which doesn't move the number that actually gates
approval — the deploy-status and on-device-verification questions do.
Inflating this number because more polish happened would be exactly the
kind of scoring this report was told not to do.

## 10. Exact work required for top-tier-fintech-indistinguishable quality

In priority order:

1. **Confirm the security fix is actually deployed to production** —
   five minutes to check, and nothing else on this list matters if it
   isn't.
2. **Run `ON_DEVICE_TEST_SCRIPT.md` once**, in full, on a real phone in
   real World App — still the single highest-leverage remaining action
   in this entire project, named in three consecutive reports now.
3. **Rebuild Wallet, Support, Guidelines, and Admin** with the same
   structural treatment Profile just got — the direct, mechanical next
   step now that the pattern (receipt-line/ledger-row reuse, line before
   block) is proven across five screens.
4. **Finish the icon set** — redraw the remaining navigation/utility
   glyphs to match the Bridge/arrow/stamp family's geometry rules.
5. **A genuine visual QA pass** the moment screenshot capture is
   available in any future session — everything in this report and its
   predecessors has been verified by code, computed values, and DOM
   inspection; none of it has been confirmed by a human or an AI
   actually looking at the rendered screen, and that gap should close
   before any "this is done" claim is made about visual polish
   specifically.
