/**
 * Tender haptic vocabulary.
 *
 * MiniKit only exposes three primitives — impact(light/medium/heavy),
 * notification(success/warning/error), and selection-changed. There is no
 * custom-waveform API. So distinct "financial events" are built by composing
 * short, deliberately-timed sequences of those primitives rather than
 * inventing capability the SDK doesn't have. Each sequence is designed to
 * physically resemble the event it represents:
 *
 *   select        — a single, neutral tick. Something changed, nothing moved.
 *   tap            — a single light knock. Acknowledges a press.
 *   commit         — a single firm knock. "I heard your intent" (order
 *                    placed, phone number saved) — before money has moved.
 *   send           — heavy thud, then a soft chirp ~70ms later. Weight
 *                    leaving your hand, then confirmation it left.
 *   receive        — light knock, then a clean success chirp ~60ms later.
 *                    Arrival reads brighter/lighter than departure.
 *   settle         — two heavy thuds ~90ms apart. The literal feel of a
 *                    stamp coming down twice on a ledger page — used when
 *                    an order flips to "Completed".
 *   bridgeComplete — light → medium → success, ~70ms apart. An ascending
 *                    run that feels like crossing from one side to the
 *                    other — used when a quote locks / a rate refresh lands.
 *   verify         — a single clean success chirp. World ID / wallet auth.
 *   warn / fail    — the two notification variants MiniKit gives us,
 *                    reserved exclusively for recoverable vs blocking
 *                    problems so they stay meaningfully different.
 *   insufficientBalance — two rapid light knocks, ~50ms apart. A stutter,
 *                    not a chirp — this didn't even register as a valid
 *                    attempt, it's rejected before anything could move.
 *                    Deliberately lighter than warn/fail so it never gets
 *                    confused with "something you did failed" — nothing
 *                    was attempted yet.
 *   fraudAlert     — three notification-error pulses, ~80ms apart. The
 *                    only *repeated* error signature in the app — a
 *                    single error means "that didn't work", a triple
 *                    means "stop and look at the screen".
 *   escrowRelease  — a selection tick, then a success chirp ~80ms later.
 *                    Softer than send/settle on purpose (no heavy impact
 *                    anywhere in it — nothing the user just did caused
 *                    this), and deliberately opens on "selection" rather
 *                    than "light" so its type sequence doesn't collapse
 *                    into `receive`'s (light→success) — a difference in
 *                    timing alone (60ms vs 80ms) isn't something a
 *                    finger can reliably tell apart.
 *   pendingSettlement — a tick, then a soft knock ~90ms later (rising:
 *                    quiet → firm). Fires when a user opens a ledger
 *                    entry that's still awaiting review — "yes, this is
 *                    still being looked at," the opposite intent of
 *                    cancellation below, so the two are built as mirror
 *                    images of each other rather than unrelated patterns.
 *   cancellation   — a knock, then a tick ~40ms later (falling: firm →
 *                    quiet). Fires when a user backs out of an in-progress
 *                    order — the sequence retracting rather than landing.
 */
import { haptic } from "./worldAppService";

function after(ms, type) {
  setTimeout(() => haptic(type), ms);
}

export const tenderHaptics = {
  select: () => haptic("selection"),
  tap: () => haptic("light"),
  commit: () => haptic("medium"),
  send: () => {
    haptic("heavy");
    after(70, "success");
  },
  receive: () => {
    haptic("light");
    after(60, "success");
  },
  settle: () => {
    haptic("heavy");
    after(90, "heavy");
  },
  bridgeComplete: () => {
    haptic("light");
    after(70, "medium");
    after(140, "success");
  },
  verify: () => haptic("success"),
  warn: () => haptic("warning"),
  fail: () => haptic("error"),
  insufficientBalance: () => {
    haptic("light");
    after(50, "light");
  },
  fraudAlert: () => {
    haptic("error");
    after(80, "error");
    after(160, "error");
  },
  escrowRelease: () => {
    haptic("selection");
    after(80, "success");
  },
  pendingSettlement: () => {
    haptic("selection");
    after(90, "light");
  },
  cancellation: () => {
    haptic("light");
    after(40, "selection");
  },
};
