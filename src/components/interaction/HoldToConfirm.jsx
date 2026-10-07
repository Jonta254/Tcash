import { useCallback, useEffect, useRef, useState } from "react";
import { tenderHaptics } from "../../services";
const HOLD_MS = 650;
export default function HoldToConfirm({ onConfirm, label, holdingLabel, disabled, className = "" }) {
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const cancel = useCallback(() => {
    clearTimeout(timer.current); timer.current = null; setHolding(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled, cancel]);
  const confirm = useCallback(async () => {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setBusy(true); cancel();
    try { await onConfirm(); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }, [disabled, onConfirm, cancel]);
  const start = (event) => {
    if (disabled || inFlight.current || timer.current) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    if (event.repeat || (event.type === "pointerdown" && event.button !== 0)) return;
    event.preventDefault(); tenderHaptics.tap(); setHolding(true);
    timer.current = setTimeout(() => { void confirm(); }, HOLD_MS);
  };
  return (
    <button type="button" className={`hold-confirm${holding ? " holding" : ""} ${className}`.trim()}
      disabled={disabled || busy} aria-busy={busy}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onKeyDown={start} onKeyUp={cancel} onBlur={cancel}
      onClick={event => { if (event.detail === 0) void confirm(); }}
      style={{ "--hold-ms": `${HOLD_MS}ms` }} aria-label={`${label} — press and hold to confirm`}>
      <span className="hold-confirm-fill" aria-hidden="true" />
      <span className="hold-confirm-label">{busy ? "Submitting…" : holding ? holdingLabel || "Keep holding…" : label}</span>
    </button>
  );
}
