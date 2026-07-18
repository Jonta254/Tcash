import { useRef } from "react";
import { tenderHaptics } from "../../services";

/*
 * The one plain number input left in the app's critical path. Same
 * contract as before — a raw numeric string in, a raw numeric string
 * out via onChange, so useOrderFlow's validation/calculation is
 * completely untouched — but the actual typing moment now has a
 * hero-scale serif figure (the same size tier as a live quote, per
 * DESIGN_SYSTEM's transaction-amount ladder), comma-grouped as you
 * type, and a light haptic tick on every digit so entering an amount
 * feels like counting something out rather than filling in a form
 * field. The cursor stays pinned to the end deliberately — amount
 * entry is almost always append-or-backspace, never a mid-number edit,
 * and a input that scrolled the caret away from where you're typing
 * would be a worse trade than not supporting free-form cursor
 * placement at all.
 */
export function formatWithCommas(raw) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

export function sanitizeRaw(input) {
  let cleaned = input.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

function AmountField({ id, label, value, onChange, placeholder, suffix, autoFocus }) {
  const inputRef = useRef(null);
  const prevDigitCount = useRef(String(value || "").replace(/\D/g, "").length);

  const handleChange = (event) => {
    const raw = sanitizeRaw(event.target.value);
    const digitCount = raw.replace(/\D/g, "").length;

    if (digitCount > prevDigitCount.current) {
      tenderHaptics.select();
    }
    prevDigitCount.current = digitCount;

    onChange(raw);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  return (
    <div className="tdr-amount-field">
      {label ? <label htmlFor={id} className="tdr-amount-field-label">{label}</label> : null}
      <div className="tdr-amount-field-row">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={formatWithCommas(value)}
          onChange={handleChange}
          placeholder={placeholder}
          className="tdr-amount-field-input"
          aria-label={label}
        />
        {suffix ? <span className="tdr-amount-field-suffix">{suffix}</span> : null}
      </div>
    </div>
  );
}

export default AmountField;
