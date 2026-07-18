# TCash — On-Device Test Script

This exists because no amount of code review substitutes for running the
app inside real World App on a real phone. Every item below is something
this project's tooling cannot observe from here — that's not a gap in
effort, it's a gap in what's physically accessible from a text/code
environment. Run this once on an Android phone with World App installed,
using the production URL (`https://world-t-mpesa.vercel.app`) opened as
a mini app, not a regular browser tab.

For each item: note **Pass**, **Fail**, or **Different than expected**
— and for anything not Pass, capture the exact error text or a
screenshot. That's the raw material a fix gets built from; "it didn't
work" isn't enough to act on, "I tapped Continue with World App, the
wallet-approval sheet appeared, I approved, then the app showed a blank
screen for 8 seconds before Home loaded" is.

---

## Part 1 — World App integration

- [ ] **Wallet connection**: Tap "Continue with World App" on Login.
      Does the wallet-approval sheet appear promptly? Does approving it
      return you to TCash automatically, or does it require manually
      switching back?
- [ ] **SIWE / session**: After approving, do you land on Home
      logged in, with your real World username shown? Close World App
      fully (swipe away from recents) and reopen TCash — are you still
      logged in, or does it ask you to reconnect?
- [ ] **World ID verification status**: Does anything in Profile or
      during a trade reference your verification level/status
      correctly, or does it show a generic/wrong state?
- [ ] **Deep link**: From outside World App (e.g. a notification or a
      shared link), does `worldapp://mini-app?app_id=...` actually open
      TCash inside World App, landing on the right screen?
- [ ] **Haptics**: Do you feel a distinct tap on button presses, a
      firmer knock when placing an order, and a "double thud" feeling
      specifically when an order settles? They're designed to feel
      different from each other — note if any feel identical or absent.
- [ ] **Notification permission prompt**: Does the in-app prompt to
      enable World push notifications correctly trigger World App's real
      permission dialog, and does the app correctly detect whether you
      granted or denied it afterward?

## Part 2 — The actual money-moving flows

- [ ] **Buy, full flow**: Enter a KES amount → confirm → see the M-Pesa
      PayBill instructions → (you don't need to actually pay) → enter a
      fake M-Pesa code → hold the "Hold to submit payment" button for
      the full press. Does it require a genuine sustained hold, or does
      a quick tap accidentally trigger it? Does the receipt screen
      appear with correct numbers?
- [ ] **Sell, World Pay path**: Start a sell order, reach the "Hold to
      send" step. When you hold it, does World App's native payment
      sheet open correctly with the right amount and destination shown?
      **Do not complete a real payment unless you intend to** — the
      point is to confirm the sheet opens correctly and that canceling
      out of it returns you to TCash in a sane state (not stuck, not
      showing a false success).
- [ ] **Order History**: After creating a test order, does it appear
      correctly in History? Does tapping it expand to show the details
      (not just navigate away)?

## Part 3 — Interruption recovery (this is the category most likely to surface a real bug)

For each of these, the question is always the same: **does TCash
recover to a sane, honest state, or does it get stuck / lie about what
happened?**

- [ ] Start a Buy order, get to the M-Pesa payment screen, then **lock
      your phone's screen** for 30 seconds. Unlock — is TCash still on
      the same step with your entered data intact?
- [ ] Start a Sell order, reach the "Hold to send" step, then **switch
      to the M-Pesa app** (as if actually checking a payment) and come
      back to World App after 15+ seconds. Is TCash still where you left
      it?
- [ ] Start a Sell order's World Pay flow, and when the native payment
      sheet appears, **background World App entirely** (home button),
      wait 10 seconds, then reopen World App. Did TCash's screen state
      survive, or did it reset — and if it reset, does it show anything
      false (like a stale "success" state) or does it correctly show
      "start over"? **This is the single highest-value thing to test in
      this whole script** — it's the one interruption scenario flagged
      in every prior review as impossible to verify without a device.
- [ ] Simulate a phone call arriving mid-flow (or just answer a real one
      if convenient) during any trade step. Same question: sane recovery
      or stuck/false state?
- [ ] **Turn on airplane mode** mid-flow (after entering an amount, before
      submitting). Does the app show the offline banner? Turn airplane
      mode back off — does it recover and let you continue, or does it
      require restarting the flow?
- [ ] **Force-quit TCash mid-flow** (not just background — actually kill
      it from World App's task switcher) after starting but before
      completing a trade. Reopen — does History correctly show nothing
      was created (since nothing should have synced yet), or does
      something inconsistent appear?

## Part 4 — Device conditions

- [ ] **Dark mode**: Toggle your phone's system dark mode (or use the
      in-app theme toggle) — does everything stay legible, especially
      status colors and the M-Pesa payment card?
- [ ] **Poor network**: If you can throttle to 3G-equivalent (many
      Android phones have a developer-options network simulator, or just
      test somewhere with weak signal) — does the app show a clear
      loading/timeout state, or does it hang silently?
- [ ] **A second, different Android device/screen size**, if available
      — does layout hold up, or does anything clip/overflow?
- [ ] **System font-size increase** (Settings → Display → Font size,
      turn it up) — does TCash's layout stay usable, or does text get
      cut off?
- [ ] **TalkBack** (Android's screen reader), even just briefly on the
      Login and Home screens — can you navigate by swipe and understand
      what's focused? (No prior report has been able to verify this at
      all — this is genuinely first-time coverage if you do it.)

## Part 5 — Trying to break it (report anything that *doesn't* fail safely)

- [ ] After logging in, wait — or force it — until you'd expect a
      session to be old (this may not be practically testable in one
      sitting given the session lasts 30 days; skip if impractical) —
      does an expired/invalid session get a clear "please sign in again"
      rather than a confusing error?
- [ ] Try submitting the same M-Pesa code twice on two different orders
      (place two small buy orders, use the identical fake code on both).
      The second one should be rejected with a specific "already used"
      message, not silently accepted.

---

## What to send back

For anything marked Fail or Different-than-expected: the exact screen,
what you did, what you expected, what actually happened, and a
screenshot if at all possible. That's what turns "on-device testing
found issues" into an actual fix.
