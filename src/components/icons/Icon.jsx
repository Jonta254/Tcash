/*
  Tender iconography.

  Two semantic families, drawn with different terminal geometry so the
  distinction is real (inspectable in the SVG) and not just a size/color
  variant:

  - "ledger" icons (navigation, utility — home/wallet/history/bell/clock/
    phone/gift/refresh/logout/sun/moon/close) keep round caps and joins —
    soft, human.
  - "tender" icons (financial action — bridge, arrowUp/arrowDown, arrowRight,
    check) use flat/square caps and mitered joins — a cut-banknote edge,
    deliberately not soft. bridge/arrowUp/arrowDown/check share a stroke
    vocabulary with the app's Bridge motif (Login, Home) — same two-anchor-
    and-line grammar, not a separate icon language bolted on top.

  Default stroke is 1.75 (not the generic Feather/Lucide 2) — a slightly
  lighter, engraved weight rather than an "app icon" weight.
*/
const TENDER_FAMILY = new Set(["bridge", "swap", "arrowUp", "arrowDown", "arrowRight", "check"]);

const PATHS = {
  home: "M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9",
  wallet:
    "M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8h.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5H5.5A2.5 2.5 0 0 1 3 15.5v-8ZM15.5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  /* the Bridge — two anchor ticks, a line, a live gap at center. Replaces
     the generic circular-arrows "swap" glyph everywhere; "swap" is kept
     as an alias so existing call sites don't need to change. */
  bridge: { d: "M5 9v6M19 9v6M5 12h5.5M13.5 12h5.5", dot: { cx: 12, cy: 12, r: 1.4 } },
  history:
    "M12 7v5l3.5 2 M21 12a9 9 0 1 1-3.2-6.9 M3 4v4h4",
  sun: "M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z",
  bell: "M7 9a5 5 0 0 1 10 0v4l1.7 3.4a1 1 0 0 1-.9 1.6H6.2a1 1 0 0 1-.9-1.6L7 13V9ZM10 19a2 2 0 0 0 4 0",
  close: "M6 6l12 12M18 6 6 18",
  /* stamp-check: a checkmark inside a ring — the ledger "stamped" mark,
     used for completed/settled/verified states. */
  check: { d: "M8 12.4 10.8 15.4 16 9", ring: { cx: 12, cy: 12, r: 9.2 } },
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  /* ticket-tab arrows: a flat-capped stem meeting an open chevron —
     reads like a stub tearing off, not a generic pointer. */
  arrowUp: "M12 18V8M7.5 12.5 12 8l4.5 4.5",
  arrowDown: "M12 6v10M7.5 11.5 12 16l4.5-4.5",
  arrowRight: "M5 12h11M13 7l6.5 5-6.5 5",
  hexagon: "m12 3 8 4.6v8.8L12 21l-8-4.6V7.6L12 3Z",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2",
  gift: "M12 8v13M3 12h18M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5",
  refresh: "M3 12a9 9 0 0 1 15.3-6.4M21 12a9 9 0 0 1-15.3 6.4M18 3v3.5h-3.5M6 21v-3.5h3.5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};
PATHS.swap = PATHS.bridge;

function Icon({ name, size = 18, strokeWidth = 1.75, className, style }) {
  const entry = PATHS[name];

  if (!entry) {
    return null;
  }

  const isTender = TENDER_FAMILY.has(name);
  const d = typeof entry === "string" ? entry : entry.d;
  const dot = typeof entry === "object" ? entry.dot : null;
  const ring = typeof entry === "object" ? entry.ring : null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={isTender ? "square" : "round"}
      strokeLinejoin={isTender ? "miter" : "round"}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {ring ? <circle cx={ring.cx} cy={ring.cy} r={ring.r} strokeWidth={strokeWidth * 0.85} /> : null}
      <path d={d} />
      {dot ? <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}

export default Icon;
