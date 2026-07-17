import { useCallback, useRef, useState } from "react";
import { tenderHaptics } from "../../services";

const HOLD_MS = 650;

/*
 * The one control in TCash that requires sustained, deliberate intent
 * instead of a tap — reserved exclusively for the final, irreversible
 * step of a money movement (submitting an M-Pesa code, sending crypto
 * via World Pay). A tap can be an accident; 650ms of continuous contact
 * can't. The fill is a quiet copper wash sweeping left→right under the
 * label, not a separate progress ring — the button itself is the meter.
 */
function HoldToConfirm({ onConfirm, label, holdingLabel, disabled, className = "" }) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const armedRef = useRef(false);

  const cancel = useCallback(() => {
    if (armedRef.current) return;
    window.clearTimeout(timerRef.current);
    setHolding(false);
  }, []);

  const start = useCallback(
    (event) => {
      event.preventDefault();
      if (disabled || armedRef.current) return;
      tenderHaptics.tap();
      setHolding(true);
      timerRef.current = window.setTimeout(() => {
        armedRef.current = true;
        setHolding(false);
        onConfirm();
        window.setTimeout(() => {
          armedRef.current = false;
        }, 400);
      }, HOLD_MS);
    },
    [disabled, onConfirm],
  );

  return (
    <button
      type="button"
      className={`hold-confirm${holding ? " holding" : ""} ${className}`.trim()}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      style={{ "--hold-ms": `${HOLD_MS}ms` }}
      aria-label={`${label} — press and hold to confirm`}
    >
      <span className="hold-confirm-fill" aria-hidden="true" />
      <span className="hold-confirm-label">{holding ? holdingLabel || "Keep holding…" : label}</span>
    </button>
  );
}

export default HoldToConfirm;
