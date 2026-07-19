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
  /* detached-tick sunburst: rays sit off the ring rather than touching it
     (the same "gap" grammar as the Bridge's center gap), filled center
     instead of a stroked circle — a stamped seal, not a Feather sun. */
  sun: { d: "M12 4V2M12 22v-2M22 12h-2M4 12H2M17.5 6.5l1.1-1.1M6.5 17.5l-1.1 1.1M17.5 17.5l1.1 1.1M6.5 6.5 5.4 5.4", dot: { cx: 12, cy: 12, r: 3.2 } },
  /* crescent + a small spark tick — distinguishes it from a plain Feather
     crescent while keeping the silhouette legible at 16px. */
  moon: "M19 13.5A7.5 7.5 0 1 1 10.5 5a6 6 0 0 0 8.5 8.5ZM17.2 3v2.4M16 4.2h2.4",
  bell: "M7 9a5 5 0 0 1 10 0v4l1.7 3.4a1 1 0 0 1-.9 1.6H6.2a1 1 0 0 1-.9-1.6L7 13V9ZM10 19a2 2 0 0 0 4 0",
  /* four converging corner ticks instead of one bold corner-to-corner
     X — an engraved close mark, not the stock Feather glyph. */
  close: "M7 7l2.5 2.5M17 7l-2.5 2.5M7 17l2.5-2.5M17 17l-2.5-2.5",
  /* stamp-check: a checkmark inside a ring — the ledger "stamped" mark,
     used for completed/settled/verified states. */
  check: { d: "M8 12.4 10.8 15.4 16 9", ring: { cx: 12, cy: 12, r: 9.2 } },
  /* timestamp seal: hands plus four bezel ticks inside the same ring
     radius as the stamp-check mark, so both read as "official" marks. */
  clock: { d: "M12 7v5l3.3 2M12 3.4v1.8M12 18.8v1.8M3.4 12h1.8M18.8 12h1.8", ring: { cx: 12, cy: 12, r: 9.2 } },
  /* ticket-tab arrows: a flat-capped stem meeting an open chevron —
     reads like a stub tearing off, not a generic pointer. */
  arrowUp: "M12 18V8M7.5 12.5 12 8l4.5 4.5",
  arrowDown: "M12 6v10M7.5 11.5 12 16l4.5-4.5",
  arrowRight: "M5 12h11M13 7l6.5 5-6.5 5",
  hexagon: "m12 3 8 4.6v8.8L12 21l-8-4.6V7.6L12 3Z",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2",
  mail: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11ZM4.5 6.5 12 12l7.5-5.5",
  chat: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z",
  /* wrapped parcel with a wax-seal dot at the ribbon join instead of
     Feather's bow loops — matches the receipt/stamp visual language. */
  gift: { d: "M4 10.5h16M4 10.5v8.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8.5M4 10.5V8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2.5M12 7v13", dot: { cx: 12, cy: 7, r: 1.6 } },
  refresh: "M3 12a9 9 0 0 1 15.3-6.4M21 12a9 9 0 0 1-15.3 6.4M18 3v3.5h-3.5M6 21v-3.5h3.5",
  /* open door bracket + a line ending in a perpendicular flag-tick
     instead of a chevron arrowhead — a signpost, not a Feather log-out. */
  logout: "M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M20 12H9.5M17 9v6",
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
