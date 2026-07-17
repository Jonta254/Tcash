# Tender — the TCash design system

Tender is not a theme. It's the claim that TCash's job is to *record money
moving between two systems that don't officially speak to each other* —
a World wallet and M-Pesa — with a human reviewer in between. Every
decision below serves that one sentence. Nothing here is "premium
fintech" seasoning; if a rule doesn't trace back to that sentence, it
doesn't belong in the system.

**Status key** used throughout: `LIVE` = shipped in code today. `SPEC` =
fully defined, ready to implement, not yet wired into a screen.

---

## 1. Typography Language

**Primary display philosophy.** TCash has exactly one display face:
`ui-serif` (resolves to New York on iOS, the platform serif elsewhere),
`--font-ledger` in code. It is used for exactly three things, never more:
the wordmark, money amounts, and section-anchor numerals (order counts,
milestone counts). Everything else — labels, body copy, buttons, status
words — is the platform sans (`-apple-system` / Roboto stack). This is
the single rule that makes a TCash screenshot recognizable with the logo
cropped out: **no other app in this category pairs a serif ledger face
with a native sans UI face.** Crypto apps are sans-only, top to bottom,
because they're optimized to look like software. TCash is optimized to
look like a statement.

**Transaction typography philosophy.** A number that represents money the
user is about to move, or has moved, is always set in `--font-ledger`,
always `font-variant-numeric: tabular-nums`, and is always the largest
or second-largest text on its screen. A number that's *metadata about* a
transaction (a timestamp, a count, a percentage) stays in sans, small,
muted. The rule: **if it's currency, it's serif and it's big. If it's
context about currency, it's sans and it's quiet.** `LIVE` — see
`.tdr-home-balance-num`, `.tdr-bridge-asset-amt`, `.pic-amount`.

**Numerical typography philosophy.** All money numerals are tabular
(fixed-width digits) so a column of amounts aligns vertically without
manual padding — this is a statement/ledger convention, not a UI
convention, and it's part of why the ledger metaphor reads as real
rather than decorative. Currency codes (KES, WLD, USDC) are never in the
same visual weight as the amount they modify — always smaller, always
sans, always `--muted` or a half-step down from the amount's color, so
the eye locks onto the number first.

**When serif is used:** wordmark, balance, trade amounts, order figures,
milestone/reward numbers, the stamp mark's implied "signature" quality.
**When sans is used:** everything else — nav labels, buttons, form
labels, status words, body copy, timestamps, help text. If you're
unsure which a given piece of text is, ask: "if this were printed on a
bank statement, would it be typeset or stamped?" Typeset → sans.
Stamped/written-in → serif.

**Transaction amount typography — the size ladder.** Not every amount is
equal, and TCash encodes that with size alone, no labels required:
`clamp(2.6rem, 12vw, 3.4rem)` is reserved *exclusively* for the one
number that answers "what do I have right now" (the home balance) —
there is only ever one number this large on screen at once. `1.5–1.7rem`
serif is the amount actively being negotiated (the live quote mid-trade
— what you're about to pay/receive). `0.9–1.1rem` serif is a settled
historical figure (a ledger row, an order's recorded amount) — smaller
because it's no longer live, it's filed. A user should be able to tell
"is this number still moving or already recorded" from size alone,
before reading a single status word. `LIVE`.

**Exchange rate typography.** A rate is never the largest number on its
row — it is always sans, always `--muted`, always positioned *after*
the amount it explains, never before. Rates get one privilege nothing
else in sans gets: they may sit directly beside a serif amount without
a label, because the pairing itself (`4.2 WLD` next to `KES 49.82`) is
legible as "amount → its worth" purely from adjacency and the
serif/sans contrast. If a rate ever needs a label like "Rate:" to be
understood, the typographic hierarchy has failed and the rule should be
revisited, not patched with a label. `LIVE` (`.tdr-bridge-asset-rate`).

**Verification typography.** Verification never gets its own emphasized
type treatment — no bold, no color, no larger size. It is 0.7rem sans,
600 weight, `--muted`, exactly matching `.tdr-trust-verified`. The
reasoning is deliberate: emphasizing "verified" typographically is what
apps do when trust is a marketing claim. TCash's verification is
structural (World ID, a human reviewer), so it doesn't need to shout —
it sits at the same visual volume as any other piece of quiet metadata,
and the *dot*, not the text, carries the trust signal (see §7). `LIVE`.

**Weight hierarchy.** Sans: 400 body, 600 labels/buttons/status,
700 section headers (uppercase, tracked). No 500, no 800/900 — TCash
does not use extra-bold anywhere, which is itself a differentiator from
the bold-everything look of generated fintech UI. Serif: 500 for
amounts (never bold — a bold serif numeral looks like a logo, not a
statement), 500 italic reserved exclusively for the wordmark and the
avatar-initial glyph (`.shell-avatar`), so italic serif becomes a
*signature*, not a general-purpose style.

**Number spacing.** Tabular figures throughout money contexts (`LIVE`).
Currency amounts never wrap — `overflow-wrap: anywhere` is intentionally
*not* applied to `.tdr-home-balance-num`; a balance either fits or the
layout was wrong, it never breaks mid-number. Section labels use
`letter-spacing: 0.06–0.14em` uppercase — the one place TCash uses
tracked caps, reserved for section headers and the login kicker so it
doesn't become wallpaper.

---

## 2. Motion Language

One easing curve for the entire app: `--ease-tender:
cubic-bezier(0.22, 1, 0.36, 1)` — a confident decelerate, landing hard
then settling, never a linear or bouncy overshoot. Three durations only:
`--t-fast: 160ms` (acknowledgment — a tap, a toggle), `--t-base: 280ms`
(a state change — a panel appearing, a value updating), `--t-slow:
460ms` (a settlement — something is now *final*). If a proposed
animation doesn't fit one of these three durations, it's decorative and
gets cut.

| Moment | Behavior | Why | Status |
|---|---|---|---|
| Route transition | Fade + 8px rise, `--t-base`, no slide/push | A statement page turns, it doesn't slide like an app screen | `LIVE` (`.page-enter`) |
| Refresh interaction | Icon rotates continuously at 0.9s linear while in flight, then a single `--ease-tender` settle-stop — never an infinite spinner with no resolution | Communicates "still working" without feeling stuck | `LIVE` (`.tdr-home-refresh .spin`) |
| Bridge completion (rate refresh lands) | Three-stage haptic (`tenderHaptics.bridgeComplete`) synced to the live-dot's pulse resetting | Ascending certainty — you feel the rate "arrive" | `LIVE` (haptic), dot resync `SPEC` |
| Confirmation transition (order drafted → payment step) | Content cross-fades `--t-base`, no card flip/slide — this is a statement turning to the next line, not a wizard | Wizard-slide reads as SaaS onboarding | `SPEC` |
| Payment / send completion | `--t-slow` — the amount briefly settles into place, no confetti, no scale-bounce. A single `tenderHaptics.send()` double-pulse *is* the celebration | Money leaving should feel weighty and final, not gamified | `LIVE` (haptic) / visual settle `SPEC` |
| Verification success (World ID / wallet auth) | Single clean fade, no checkmark animation — trust doesn't need decoration, it needs speed | Over-animating "you're verified" reads as insecure, not confident | `LIVE` (haptic `tenderHaptics.verify`) |
| Settlement (order flips to Completed) | The stamp mark (ring+check, §4) scales in from 1.15→1.0 over `--t-slow`, `--ease-tender` — the one place TCash allows a "landing" overshoot, because a stamp physically lands | The literal ledger-stamp metaphor made real | `LIVE` (`.status-pill.completed svg` — plays once on mount; `tenderHaptics.settle()` fires from the same trigger point once live order-status polling exists) |
| Pending settlement | No spinner, ever. A single 5px dot breathing opacity 0.35→1 / scale 0.85→1 over 1.4s ease-in-out, forever, inside the status pill itself — the *pill* is what's alive, not a separate loading indicator floating near it | Distinguishes "still being reviewed" from "broken/loading" — a spinner implies the app is doing something; a breathing dot implies a *person* is | `LIVE` (`.status-pill-motion`) |
| Escrow release | *(No escrow flow exists yet.)* Spec: the amount's dashed border (§7) resolves to solid over `--t-base` at the exact frame the stamp animation starts — the border-solidify and the stamp-land are two views of the same event, never sequenced apart | Funds becoming spendable and the record becoming final are the same moment; the motion should never imply otherwise | `SPEC` |
| Balance update | The old and new figure never cross-fade or count up — it changes on the next `--t-base` tick, tabular nums holding column width so nothing reflows | A statement doesn't animate a number counting up; it just *is* the new number | `LIVE` |

Two things TCash motion **never** does: (1) bounce/overshoot outside the
settlement-stamp exception above, (2) animate purely to hide a loading
gap. Every animation on the "why" list communicates a specific piece of
state — in-flight, settled, arrived, verified. If a proposed animation
doesn't name which of those four it's communicating, it doesn't ship.

---

## 3. Shape Language

**Radius philosophy — three values, no more.** `11px` for anything you
press (buttons), `14px` for anything that contains grouped data
(panels, the Buy/Sell split, the login/home canvas has none — see
below), `50%` for anything that represents a person, a status, or the
one floating action (avatars, the bridge dot, the tab-fab). No `8px`,
no `16px`, no `24px` pill-everything. This 3-value scale is the exact
opposite of Tailwind's `rounded-md/lg/xl/2xl/full` ladder — there is no
in-between size to reach for, which is what stops a cloned layout from
"just" using different Tailwind rounding tokens and calling it a
different app. `LIVE`.

**Edge philosophy.** TCash separates content with a **1px hairline**
(`var(--border)`), never a drop shadow. `box-shadow: none` on every
panel (`LIVE`). The only shadow in the entire system is the tab-fab's
elevation (`0 10px 22px`) — because it's the one element that's
supposed to read as physically raised off the surface. Shadow is
reserved *exclusively* for that one raised element; if shadow starts
appearing elsewhere, the system has been violated.

**Component silhouettes.** Two silhouettes exist: the **line** (a
hairline-separated row — ledger entries, bridge strip, profile stat
rows) and the **block** (a bounded 14px-radius panel — used only for
genuinely separable input surfaces: a form, the trade payment card, the
login screen has zero blocks). A screen is majority-line with
occasional blocks, never majority-block. Home today is ~90% line, ~10%
block (just the M-Pesa nudge) — that ratio is the target for every
screen going forward. `LIVE` on Login/Home, `SPEC` for the rest.

**Container relationships.** Primary content sits directly on the page
background — no card wrapping the balance, no card wrapping the Bridge
strip. Cards are reserved for content that is genuinely a bounded,
separable unit the user fills in or reviews (a form, a payment
instruction block). This is the single biggest structural break from
the "everything in a rounded rectangle" default. `LIVE`.

**Floating element rule.** Exactly one element in the entire app is
allowed to float above the content plane: the Trade tab-fab. No glass
bottom sheets, no floating toast cards, no backdrop-blur panels. If a
second floating element appears anywhere, it's a violation — merge it
into the page or cut it. `LIVE`.

**Spacing rhythm.** Base unit 2px. The working scale is **6 · 10 · 14 ·
18 · 28** — section-to-section gap is always 28, hairline-row padding is
always 13–14, tight inline gaps are 6, form gaps are 12. No arbitrary
15px/17px/22px one-offs creeping in over time; every new spacing value
gets snapped to this scale or it's wrong. `LIVE` on rebuilt screens.

---

## 4. Iconography System — "Tender Marks"

The Feather/Lucide-shaped set is retired for the icons users see most.
Two families, distinguished by real, inspectable SVG geometry — not a
size or color variant:

- **Ledger family** (navigation/utility — home, wallet, history, bell,
  clock, phone, gift, refresh, logout, sun, moon, close): round caps,
  round joins. Soft, human, Monzo-warm.
- **Tender family** (financial action — the Bridge/swap mark, arrowUp,
  arrowDown, arrowRight, the stamp-check): **square caps, mitered
  joins.** A cut-banknote edge. `strokeLinecap="square"
  strokeLinejoin="miter"`, hard-coded per family in `Icon.jsx` — not a
  prop callers set, so the rule can't drift. `LIVE`.

**Stroke width:** 1.75 at a 24px viewBox (not the generic Feather 2) —
scales proportionally with `size`. A half-step lighter than the default
"app icon" weight, closer to a plate-engraved line. `LIVE`.

**The Bridge glyph *is* the Bridge motif.** Two anchor ticks, a line, a
gap at center for a dot — literally the same drawing that appears on
Login and Home as the live-rate visualization. The icon system and the
signature graphic are one drawing at two scales, not two unrelated
decisions. `LIVE` (`Icon.jsx`, name `bridge`, aliased as `swap`).

**arrowUp / arrowDown (Buy/Sell)** are drawn as a flat-capped stem
meeting an open chevron — reads as a ticket stub tearing off rather
than a generic pointer. `LIVE`.

**check (settlement/verification)** is a checkmark inside a stroked
ring — the stamp mark. Not a bare tick. This is the one glyph that
appears across three different contexts (StatusPill's completed state,
the settlement motion spec in §2, and any future World-ID-verified
badge) — deliberately reused so "the ring+check" becomes a single
learned symbol for *this is settled/verified*, not three different
checkmarks that happen to look similar. `LIVE` (`Icon.jsx`, and wired
into `StatusPill`).

**Optical sizing:** icons are never used below 12px or above 24px in
this system — under 12 the family distinction (square vs round caps)
disappears, over 24 the 1.75 stroke starts reading as thin/broken. Three
fixed checkpoints, not a continuous scale: **12px** (inline with text —
StatusPill, ledger-row glyphs), **17–18px** (interactive — nav, buttons),
**21px** (the one raised element, the tab-fab's Bridge mark). An icon
never sits between checkpoints; if a spot seems to need 15px, it needs
12 or 18, not a custom size.

**Corner treatment.** This is the rule that makes the two icon families
actually *look* related instead of arbitrary: every ledger-family icon
with a rectangular silhouette (wallet, phone) reserves one corner at a
tighter radius than the others — a single "clipped" corner, echoing a
torn ticket-stub. Tender-family icons have no rounded corners to clip in
the first place (mitred joins are already hard corners), so their
version of the same idea is the deliberate *gap* in the Bridge's line
and the *notch* in the arrowUp/arrowDown chevrons — an interruption
instead of a corner-cut. Both families are saying the same thing
("this edge was cut, not rendered") through the geometry available to
them. `SPEC` for the corner-clip on the remaining ledger icons; the
gap/notch version is already `LIVE`.

**Motion behavior.** Icons move only when what they represent is
moving: the refresh glyph spins only while a request is in flight
(never idle-animated for "liveliness"), the Bridge's center dot pulses
only while a rate is verified live, the stamp-check plays its landing
animation exactly once, on the frame a status becomes "completed" —
never on hover, never as a loading placeholder. An icon that animates
without a state change behind it is a violation of the motion language
in §2, not a separate icon-specific exception. `LIVE`.

**Semantic grouping — three categories, not two.** Beyond the
cap/join split there's a meaning split icon choice must respect:
*directional* (arrowUp/arrowDown/arrowRight/Bridge — something is
moving from A to B), *evidentiary* (the stamp-check, the trust dot —
something is now true/verified), *wayfinding* (home/wallet/history/
gift/bell/phone/clock/settings — where am I, what can I do). A single
icon is never reused across categories — the stamp-check never doubles
as a generic "done" tick in a checklist, arrowUp never doubles as a
generic "increase" indicator on a stat. If a new screen needs an icon
and every existing glyph is a near-fit, draw a new one rather than
borrow one across categories — cross-category reuse is what erodes a
symbol system's meaning over time.

**Not yet redrawn** (`SPEC`, ledger family, lower visual priority):
home, wallet, history, hexagon (receive), phone, gift, bell, clock,
refresh, logout, sun/moon, close. These keep their current silhouettes
for now — geometrically fine, not part of the "look like every other
crypto app" problem the way the old swap-arrows-in-a-circle and generic
straight arrows were.

---

## 5. Trust Language

TCash's trust signals are **shape + motion, not paragraphs.** A user
should be able to mute the sound, squint at the screen, and still know
whether something is safe, moving, or done.

| Signal | Visual | Status |
|---|---|---|
| World ID verified | `.tdr-trust-verified` — a 5px solid dot in `--success` + small caps label, inline, never a big badge/pill | `LIVE` |
| In motion / pending settlement | `.status-pill-motion` — a 5px dot that breathes (opacity/scale pulse, 1.4s) inside the status pill itself | `LIVE` |
| Completed / settled | The stamp mark (ring+check) rendered *inside* the status pill, before the word "Completed" — shape carries the meaning, the word is backup | `LIVE` |
| Rejected / cancelled | Deliberately **inert** — no dot, no icon, flat muted-red text. The absence of motion is itself the signal: this transaction is not going anywhere | `LIVE` |
| Bridge confirmation (live rate) | The Bridge strip's center dot pulses only while a rate is verified live (`hasLiveRates`); it's static/absent the instant a rate is stale | `LIVE` |
| Escrow / held funds | *(No escrow flow exists in TCash today — manual admin release only.)* Spec for when one exists: a dashed (not solid) hairline border on the amount, signaling "recorded but not yet released" — solid border returns the instant funds move, synced to the escrow-release motion/haptic in §2/§8 | `SPEC` |
| Verified merchant / operator | Not applicable — TCash has one operator, not a merchant marketplace. If this changes, reuse `.tdr-trust-verified` rather than inventing a second trust glyph | `SPEC` |
| Suspicious / flagged activity | The *only* signal in this system allowed to use red proactively rather than reactively — a hairline border in `--error` around the specific figure in question (not the whole row/card), paired with `tenderHaptics.fraudAlert()`. Never a modal, never a full-screen interrupt — TCash flags inline and lets the human reviewer make the call, consistent with the product's actual trust model (a person, not an algorithm, has final say) | `SPEC` |
| Order awaiting the human reviewer | Distinct from generic "pending": this is specifically "a person is looking at this," not "the system is processing." Same motion dot as pending settlement (§2), but the row's status word is deliberately "Reviewing," never "Processing" — word choice is part of the trust system, not just the icon | `LIVE` (`statusLabel()` in `DashboardPage.jsx` already says "Reviewing") |

The governing rule: **one trust vocabulary, reused everywhere it
applies, rather than a bespoke badge per screen.** The dot-and-ring
language above is the entire trust system — nothing else in TCash is
allowed to invent a new "safe" indicator. The corollary: **red is
reserved for two things only** — a flagged figure (proactive) and a
rejected/cancelled outcome (retrospective). It never appears as a
generic "attention" color for anything else (form validation uses
`--warning`, not `--error`, unless the input is genuinely blocking).

---

## 6. Ledger Philosophy

TCash is not a dashboard. A dashboard tells you the state of a system;
a ledger tells you what happened. The tell is structural, not
cosmetic — you can build a "ledger-themed" dashboard with beige colors
and serif fonts and it will still be a dashboard if it's laid out as
boxes-of-stats. TCash avoids that by three structural commitments,
already load-bearing on Home:

1. **No stat grids.** A dashboard shows "Total trades: 12, Completion:
   80%" in a stat card. A ledger just shows the 12 lines. Where TCash
   currently still has stat rows (Profile's Trading Statistics), that's
   flagged as unmigrated dashboard residue in the roadmap, not a kept
   pattern.
2. **Line before block.** Per §3 — activity is a sequence of hairline
   rows you scan top to bottom, like a statement, not a shelf of cards
   you scan left to right.
3. **The number is the record.** A dashboard rounds and abstracts
   ("+2.4% this week"). A ledger states the literal figure, in the
   currency it happened in, tabular, unrounded. TCash never shows a
   derived/aggregate stat without the underlying figures being
   available one tap away.

The "not bureaucratic" half of the brief is handled by §1 and §3:
warm paper/ink instead of institutional gray-on-white, one confident
copper accent instead of an official-document palette, and generous
28px rhythm instead of dense compliance-form spacing. A ledger can be
warm; it just can't be decorated.

**The metaphor vocabulary, mapped to real product surfaces.** TCash
draws from five physical paper artifacts, and every screen should be
traceable to exactly one of them — mixing metaphors on a single screen
is what makes "ledger-themed" apps feel like a mood board instead of a
system:

| Physical artifact | What it becomes in TCash | Status |
|---|---|---|
| **Settlement record** — the line a bank writes once money has actually moved | The Home/history ledger row (`.tdr-ledger-row`) — a single hairline-bounded line, never a card | `LIVE` |
| **Transaction stamp** — an operator's ink mark confirming something is done | The ring+check stamp mark (§4), landing once per completed status (§2) | `LIVE` |
| **Transfer journal** — the running, chronological account of everything that happened, in order, un-editable | History/Orders as a whole — strictly reverse-chronological, no re-sorting, no drag-to-reorder; a journal is read in the order it was written | `LIVE` (order) / `SPEC` (full ledger-row conversion of `OrderCard`) |
| **Exchange ticket** — the small paper slip a bureau de change hands over mid-transaction, showing the rate locked in for *this* trade only | The live-quote block inside Buy/Sell step 1 (`.trade-summary-box`) — this is the one place a rate is allowed to look "written down for you" rather than just displayed, and it's why that block should eventually gain a serif treatment distinct from the passive Bridge-strip rate | `SPEC` |
| **Receipt** — the proof-of-completion handed back after the fact | The order success screen (currently still a generic ring-checkmark pattern, flagged in §7) — this is the metaphor that screen is *supposed* to embody and currently doesn't | `SPEC` |

The rule this table enforces: before adding anything new to TCash, name
which of these five it is. If it isn't clearly one of them, it's
dashboard residue and doesn't belong, regardless of how it's styled.

---

## 7. Interaction Philosophy

Replacing generic controls with TCash-specific ones:

- **Segmented Buy/Sell toggle → the trade split.** `LIVE` everywhere it
  appears — Home (navigational, one-shot) and now `TradePage.jsx`
  itself (stateful, `.tdr-trade-half.active` carries a persistent
  inset-copper-underline selected state). The two-pill segmented
  control this replaced is now fully retired from the codebase.
- **Tap-to-send → hold-to-send.** `LIVE` —
  [`HoldToConfirm.jsx`](../src/components/interaction/HoldToConfirm.jsx),
  a 650ms press-and-hold with a low-opacity copper wash sweeping under
  the label as the meter (not a separate ring — the button *is* the
  gauge), wired into both irreversible final actions: submitting an
  M-Pesa code (`BuyPage`) and sending crypto, whether via World Pay or
  a manual transaction hash (`SellPage`). Releasing early cancels with
  no penalty and a 120ms snap-back — there is no "almost sent" state,
  only "sent" or "not sent."
- **Drag-to-confirm — deliberately not built as a second pattern.**
  Once hold-to-send existed, a separate swipe-to-confirm slider was
  considered and rejected: two different gestures both meaning "commit
  irreversibly" would split muscle memory instead of building it. TCash
  has exactly one commit gesture (hold), used everywhere a commit
  gesture is needed. `SPEC` note for future maintainers: don't add a
  drag/swipe confirm without deprecating hold-to-send first.
- **Gesture amount entry.** `SPEC` — the numeric `<input type="number">`
  in Buy/Sell step 1 is the last plain form control on the critical
  path. Planned replacement: a vertical drag directly on the amount
  figure itself (drag up = increase, drag down = decrease, velocity-
  scaled so a fast drag moves in KES hundreds and a slow drag moves in
  ones) with the keyboard entry point kept as a tap-to-type fallback —
  never gesture-only, since exact amounts sometimes matter more than
  feel. `selection` haptic fires on each step-size crossing, not on
  every pixel of drag.
- **Generic cards → ledger lines.** `LIVE` on Home's recent activity.
  `SPEC` for Orders/History (`OrderCard` is still a bounded card with a
  3-dot horizontal stepper) and Wallet's asset chips.
- **Ledger reveal.** `SPEC` — the replacement for `OrderCard`'s current
  always-expanded figures grid: a ledger row is collapsed by default
  (type, amount, status only, matching Home's row exactly), and tapping
  it reveals the fuller detail (reference codes, M-Pesa number, admin
  metadata) by growing *in place* — the row's own height expands, no
  modal, no navigation, no separate detail screen. This is what turns
  Orders from "a list of cards" into "a journal you can read closer,"
  and is the highest-priority remaining structural change.
- **Generic tabs → the asymmetric bar.** `LIVE`.
- **Stat rows → inline ledger figures.** `SPEC` — Profile's "Trading
  statistics" and "Compliance and trust" stat-row blocks are the
  clearest remaining dashboard residue in the app.
- **Generic checkout success screen → the receipt.** `SPEC` — replace
  the ring-checkmark "Payment submitted!" success screen with the
  receipt metaphor from §6: the stamp mark lands (§2), then the order's
  figures lay out exactly like a `.tdr-ledger-row` rather than a
  bespoke `.oss-summary` grid, so the confirmation screen and the
  history row a user sees five minutes later are visually the same
  object — "here's your receipt" and "here's that receipt again in
  your journal" should look like one idea, not two.

---

## 8. Sound and Haptic Language

Implemented in [`src/services/tenderHaptics.js`](../src/services/tenderHaptics.js),
built on the real MiniKit primitives (`impact` light/medium/heavy,
`notification` success/warning/error, `selection-changed` — there is no
custom-waveform API, so distinct "financial events" are composed as
short timed sequences of those three primitives, not invented).

While implementing this, the previous `haptic()` helper turned out to be
silently broken — it sent `{ hapticType: type }`, but MiniKit's real
payload shape is a tagged union (`{ hapticsType: "impact", style }` /
`{ hapticsType: "notification", style }` / `{ hapticsType:
"selection-changed" }`). Every haptic call in the app has been a no-op
since it was written. Fixed in `worldAppService.js` as part of this
work — `LIVE`.

| Event | Composition | Feel | Wired at |
|---|---|---|---|
| `select` | selection-changed | a neutral tick | `LIVE` — `TradePage`'s Buy/Sell switch |
| `tap` | impact-light | acknowledges a press | every `HoldToConfirm` press-start, plus existing `haptic("light")` calls |
| `commit` | impact-medium | "I heard your intent" — before money moves | Buy and Sell order drafted (both now consistently use `commit`, not a borrowed `success`) |
| `send` | impact-heavy → +70ms notification-success | weight leaving, then confirmed | World Pay send, M-Pesa code submit, manual tx-hash submit — all three now fire from inside `HoldToConfirm`'s `onConfirm` |
| `receive` | impact-light → +60ms notification-success | lighter/brighter than send — arrival, not departure | `SPEC` (needs a receive-confirmed event — fires when the admin marks a buy order's crypto delivered) |
| `settle` | impact-heavy → +90ms impact-heavy | the stamp landing twice | `SPEC` (needs live order-status change to trigger from; the *visual* stamp landing is already `LIVE` in §2) |
| `bridgeComplete` | light → +70ms medium → +140ms success | an ascending "crossing over" run | live rate refresh landing |
| `verify` | notification-success | clean, no decoration | World wallet auth success |
| `warn` / `fail` | notification-warning / notification-error | reserved exclusively for recoverable vs. blocking problems | `LIVE` — auth error / World Pay failure |
| `insufficientBalance` | impact-light → +50ms impact-light | a stutter, not a chirp — rejected before anything could move, deliberately lighter than warn/fail | `LIVE` — Sell, when the requested amount exceeds the live wallet balance |
| `fraudAlert` | notification-error ×3, 80ms apart | the only repeated signature in the system — "stop and look" | `SPEC` (no fraud-detection logic exists yet) |
| `escrowRelease` | impact-light → +80ms notification-success | softer than send/settle — nothing the user did caused this | `SPEC` (no escrow flow exists yet) |

The governing rule: **every distinct financial outcome gets a distinct
composed pattern, and no pattern is reused for two different
meanings.** `send` and `settle` are both heavy-impact-based but differ
in timing and repetition specifically so they don't collapse into "the
generic success buzz" every other app uses. `insufficientBalance` and
`warn`/`fail` are the clearest test of this: all three are "something
is wrong," and all three are required to feel different, because a
user should eventually be able to tell *which kind* of wrong without
reading the screen.

---

## 9. Recognition Test

Line up a TCash screenshot next to World Pay, Morpho, Open, DNA, or any
other mini app in this category, strip every logo and name, and here's
what should still identify it:

1. **Warm ink/paper, not navy glass.** Every competing mini app in this
   category currently defaults to dark-navy-glassmorphism (`#0b0f1a`
   territory) with a blue/gold/cyan gradient palette. TCash is the only
   one that will read as `#15130F` espresso-black with a single copper
   accent.
2. **A serif balance.** No other mini app in this category sets money
   in a serif face. This alone survives a black-and-white printout.
3. **The Bridge mark**, appearing identically on the login screen, the
   home screen's live-rate strip, and the nav icon — one drawing, three
   places, which is the opposite of "a swap icon happens to be here
   too."
4. **Hairline-separated lines instead of card stacks.** Competing apps
   are all built from the same rounded-shadowed-card vocabulary because
   that's the default output of every app-builder. A TCash screen with
   the copy blurred out still reads as a statement, not a dashboard,
   from the silhouette alone.
5. **The asymmetric nav bar** — a flat 3-tab strip with one raised
   copper circle. No other mini app in this space uses an uneven bar;
   they all use 4–5 identical pills.

If a redesign attempt loses any of these five and still calls itself
Tender, it's failed the test — these are the non-negotiable identifiers,
everything else in this document is allowed to evolve.

---

## Final Questions

**1. What visual elements belong exclusively to TCash?**
The Bridge mark (two-anchor-tick-and-line, used identically as icon and
infographic). The warm espresso/copper material system, which no
competing mini app currently uses. The stamp mark (ring+check) as the
single reused symbol for settled/verified across every screen.

**2. What interaction patterns belong exclusively to TCash?**
Hold-to-send — the one and only commit gesture in the app, tied
specifically to the moment money actually moves, with no competing
tap-to-send shortcut anywhere. The trade split as a single cut control
rather than a segmented toggle, now consistent across every screen that
offers it. Ledger lines instead of transaction cards on Home. The
asymmetric raised-FAB nav. Of these, hold-to-send is the strongest,
because unlike a visual motif it's something a user's *hand* learns —
muscle memory transfers even faster than visual recognition, and it's
the one pattern a screenshot alone can't show, which is exactly why a
screen recording of TCash would be even more identifiable than a
screenshot of it.

**3. What typography decisions belong exclusively to TCash?**
The serif-for-money / sans-for-everything-else split, with italic serif
reserved exclusively as a wordmark/avatar signature rather than a
general display style. Tabular figures treated as a ledger convention,
not just a CSS nicety.

**4. What would competitors struggle to imitate?**
Not the color palette — that can be copied in an afternoon. What's hard
to copy is the *restraint*: three radii, three durations, one easing
curve, one accent color, one floating element, rigorously enforced. Most
competitors will add a second accent color or a fourth radius within a
sprint because it's easier than holding the line — the system is
designed so that any single addition breaks its own internal logic
(§3's floating-element rule, §4's two-family icon split) in a way that's
immediately visible to anyone maintaining it.

**5. What would users remember after one use?**
The balance number — big, serif, sitting directly on the page with
nothing around it. That's the single moment every user hits in the
first three seconds of every session, and it's the one place the whole
system (material, type, motion) is concentrated at once.

---

## Implementation ledger (what's actually done vs. spec)

`LIVE`: design tokens (`styles.css` `:root`), Login, Home, Wallet, app
shell nav, `Icon.jsx`'s bridge/arrow/check redraw, `tenderHaptics.js`
(now 12 named events, all composed from real MiniKit primitives) and
the underlying MiniKit payload fix, `StatusPill`'s stamp/motion states
plus the stamp-landing animation, `HoldToConfirm` wired into every
irreversible send action in Buy/Sell, the trade-split control on Home
and `TradePage`, a real insufficient-balance check on Sell, the
settlement receipt (`Receipt.jsx`) replacing the generic success
screen on both Buy and Sell, and `OrderCard` rebuilt as a ledger-reveal
entry (collapsed by default for settled history, open by default for
orders still needing the user's own action — same procedure, less
default clutter). `settle` and `cancellation` are now genuinely wired
to the admin's real completed/rejected actions in `AdminPage.jsx`, not
just defined.

Also fixed this pass, unrelated to visuals but blocking submission
either way: the hardcoded admin password is gone from source, README,
and the client bundle — admin sign-in now goes through
`api/admin-login.js`, checked against `ADMIN_PHONE`/`ADMIN_PASSWORD`
Vercel env vars, and a signed session cookie now gates the two
admin-only order-status writes (`completed`/`rejected`) in
`api/orders.js` server-side, not just in the client UI.

`SPEC`, next in priority order: (1) gesture amount entry on Buy/Sell
step 1, (2) Profile's stat rows → inline ledger figures and identity/
reputation framing rather than a statistics dump, (3) redraw the
remaining ledger-family icons plus their corner-clip treatment, (4)
escrow/fraud visual+haptic wiring once those features exist, (5) full
per-order server-side ownership authorization on `api/orders.js` — the
new admin-session gate covers the two admin-only status writes, but a
regular order create/update still isn't checked against the caller
actually owning that order id, which is a real remaining gap, not a
cosmetic one.
