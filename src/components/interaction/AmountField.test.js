import { describe, expect, it } from "vitest";
import { formatWithCommas, sanitizeRaw } from "./AmountField.jsx";

describe("sanitizeRaw — this is the value that reaches useOrderFlow", () => {
  it("strips everything except digits and a decimal point", () => {
    expect(sanitizeRaw("12,345")).toBe("12345");
    expect(sanitizeRaw("KES 600")).toBe("600");
    expect(sanitizeRaw("abc123")).toBe("123");
  });

  it("collapses a second decimal point instead of keeping it", () => {
    expect(sanitizeRaw("1.2.3")).toBe("1.23");
  });

  it("never mangles a value that was already clean", () => {
    expect(sanitizeRaw("4.2")).toBe("4.2");
    expect(sanitizeRaw("")).toBe("");
  });
});

describe("formatWithCommas — display only, never touches the real value", () => {
  it("groups the integer part into thousands", () => {
    expect(formatWithCommas("12345")).toBe("12,345");
    expect(formatWithCommas("1234567")).toBe("1,234,567");
  });

  it("leaves a value under 1000 alone", () => {
    expect(formatWithCommas("600")).toBe("600");
  });

  it("preserves the decimal part exactly as typed, including a trailing dot mid-entry", () => {
    expect(formatWithCommas("4.2")).toBe("4.2");
    expect(formatWithCommas("1234.")).toBe("1,234.");
    expect(formatWithCommas("1234.50")).toBe("1,234.50");
  });

  it("returns an empty string for an empty value rather than '0' or 'NaN'", () => {
    expect(formatWithCommas("")).toBe("");
  });
});
