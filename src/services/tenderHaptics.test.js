import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./worldAppService", () => ({
  haptic: vi.fn(),
}));

const { haptic } = await import("./worldAppService");
const { tenderHaptics } = await import("./tenderHaptics");

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("tenderHaptics", () => {
  it("send fires a heavy impact immediately, then a success chirp", () => {
    vi.useFakeTimers();
    tenderHaptics.send();
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(haptic).toHaveBeenCalledWith("heavy");

    vi.advanceTimersByTime(70);
    expect(haptic).toHaveBeenCalledTimes(2);
    expect(haptic).toHaveBeenNthCalledWith(2, "success");
  });

  it("settle fires two heavy impacts, not one", () => {
    vi.useFakeTimers();
    tenderHaptics.settle();
    expect(haptic).toHaveBeenCalledWith("heavy");

    vi.advanceTimersByTime(90);
    expect(haptic).toHaveBeenCalledTimes(2);
    expect(haptic).toHaveBeenNthCalledWith(2, "heavy");
  });

  it("insufficientBalance never fires a heavy or success primitive", () => {
    // The whole point of this event is that it's lighter than send/warn —
    // if it ever escalates to heavy/success it's collapsed into a
    // different event's meaning.
    vi.useFakeTimers();
    tenderHaptics.insufficientBalance();
    vi.advanceTimersByTime(200);

    const calledWith = haptic.mock.calls.map(([type]) => type);
    expect(calledWith).not.toContain("heavy");
    expect(calledWith).not.toContain("success");
  });

  it("every event is a distinct composition (no two share the exact same call sequence)", () => {
    vi.useFakeTimers();
    const sequences = new Map();

    for (const [name, fn] of Object.entries(tenderHaptics)) {
      haptic.mockClear();
      fn();
      vi.advanceTimersByTime(500);
      const sequence = haptic.mock.calls.map(([type]) => type).join(">");

      expect(
        sequences.has(sequence),
        `"${name}" has the same haptic sequence ("${sequence}") as "${sequences.get(sequence)}"`,
      ).toBe(false);
      sequences.set(sequence, name);
    }
  });
});
