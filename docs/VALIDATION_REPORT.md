# TCash — Validation Report

**Read this line before any other:** this report does not contain
on-device World App validation, because that validation did not happen.
This project has no physical device, no World App install, and no
emulator — nothing in the sections below claims otherwise. Where a
finding is genuinely observed (via browser automation against the live
deployment, or via code/test review), it's marked **Observed**. Where
World App's actual behavior is required and unavailable, it's marked
**Not verified** and stays that way rather than being inferred from how
the code "should" behave. [`ON_DEVICE_TEST_SCRIPT.md`](ON_DEVICE_TEST_SCRIPT.md)
is the actual instrument for closing those — a 25-item checklist to run
once on a real phone.

## Urgent, unrelated to the rest of this report

**The production site is exposing real user data right now.** I checked
the live deployment before writing anything else: `GET
https://world-t-mpesa.vercel.app/api/orders` currently returns all 54
real orders — phone numbers, wallet addresses, amounts — to a
completely unauthenticated request. The fix for this (session-scoped
ownership enforcement) was built and unit-tested last session but was
never committed or deployed. This is independent of everything else in
this report and shouldn't wait for it.

---

## 1. Browser-only assumptions that failed

**Observed**: none found this pass beyond what's already documented —
`MiniKit.isInstalled()` correctly returns false and the app degrades
predictably (Login shows the "Open in World App" fallback, no crash).
**Not verified**: whether anything that *works* in browser preview
*silently misbehaves* in World App is exactly what browser testing
structurally cannot reveal — that's the premise of Part 1-2 of the test
script, not something a browser session can rule out.

## 2. World App specific bugs

**Not verified.** No World App session has ever run against this code.
Nothing here can honestly be listed as a "found bug" versus a
theoretical risk — see Part 1-2 of the test script.

## 3. Mobile lifecycle bugs

**Observed** (code review, not device-confirmed): the trade flow's
in-progress state (`currentOrder`, `step`) lives only in React memory
until `commitPaidOrder` writes it to storage — meaning a WebView reload
during an interruption before that point loses the in-progress order
entirely. Whether World App's WebView actually reloads under any of the
Part 3 interruption scenarios is unknown. **Not verified**: actual
behavior under screen lock, backgrounding, or a native-sheet handoff —
this is Part 3 of the test script, and it's the single highest-value
thing left to check in this entire project.

## 4. Payment recovery issues

**Observed** (fixed in code, unit-tested, not device-confirmed): the
two silent-failure bugs from the previous session (admin optimistic
writes not rolled back; `commitPaidOrder` swallowing a server-rejected
duplicate reference) are fixed and covered by tests. **Not verified**:
whether a real interrupted World Pay send (sheet opened, app
backgrounded, result callback never arrives) leaves the user or the
order store in a bad state — Part 3 of the test script.

## 5. Security regressions

**Observed, verified by test, not by live attack**: 49 automated tests
exercise session forgery/tampering/expiry, ownership mismatch, and the
admin-recognition unification directly — I did not additionally attempt
live attacks against the deployed endpoints this pass (the previous
finding above — the undeployed fix — makes that moot until it ships).
Once deployed, Part 5 of the test script includes the two most useful
manual checks (duplicate payment reference, session validity) that
don't require special tooling.

## 6. UX regressions

**Observed**: none. Build is clean, all 49 tests pass, and the browser
pass this session found no visual/functional regression on the live
(pre-fix) deployment.

## 7. Performance findings

**Observed**: unchanged from the last report — `world-sdk` chunk
(108KB gzip) still blocks first paint of every screen including Login,
not fixed for the same reason as before (risk to wallet-init timing I
can't verify). Nothing new measured this pass.

## 8. Final launch recommendation: **Do not submit yet**

Not because anything new is wrong — because nothing on the device-only
list has been checked even once. Two things, in order:

1. **Deploy the already-fixed, already-tested authorization fix
   immediately** — this closes an active data exposure and requires no
   device testing to be confident in (it's a straightforward
   authorization tightening, unit-tested, low behavioral risk).
2. **Run `ON_DEVICE_TEST_SCRIPT.md` once**, in full, on a real phone
   with World App. Submission should follow that, not precede it.

## 9. Estimated World App approval probability after on-device verification

This can't honestly be estimated *after* something that hasn't happened
yet — that would be predicting the outcome of a test in place of running
it. What can be said: **if** the test script comes back clean (no fails
in Part 1-3), approval probability would reasonably sit in the 75-85%
range, up from the current ~55% specifically because the largest
category of unknown (does any of this actually work in World App) would
have shifted from "unverified" to "verified." If it surfaces even one
real issue in Part 3 (interruption recovery), that number depends
entirely on what's found and can't be estimated in advance.

## 10. Remaining work required before public submission

1. Commit and deploy the authorization fix (urgent, independent of
   everything else).
2. Run `ON_DEVICE_TEST_SCRIPT.md`, all 5 parts, on a real Android device
   inside real World App.
3. Fix whatever Part 3 (interruption recovery) surfaces — this is
   flagged as the most likely place to find something real.
4. Set the three admin env vars in Vercel (still outstanding, still
   trivial, still blocking the admin desk).
5. Everything else named in `RELEASE_REPORT.md` §8 (CORS tightening,
   CSP, dead-code removal) — lower priority than 1-4, can follow
   submission rather than gate it.
