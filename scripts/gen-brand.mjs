// Generates clean, text-free Tcash brand PNGs for the World Dev Portal.
// Run: node scripts/gen-brand.mjs  (needs @resvg/resvg-js available)
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

// Every color below is one of the app's own design tokens (src/styles.css
// :root, dark theme), not an independently invented palette. The previous
// version of this file used a cool navy/cyan/gold-silver scheme that never
// matched the shipped app's warm copper/paper "Tender" identity -- the logo
// and the real screenshots looked like two different products side by side.
//   --bg: #15130f   --panel: #1e1b15 (approx, panel at full opacity)
//   --primary: #c97a3a (dark)  #a85a2a (light) -- both used below as a
//     two-stop "gold" gradient, so the accent is literally the app's own
//     copper across both themes, not a color invented for the mark alone.
//   --text: #f6f1e7  --muted: #a79c87  --success: #7fa37a
const DEFS = `
  <linearGradient id="bg" x1="42" y1="26" x2="470" y2="482" gradientUnits="userSpaceOnUse">
    <stop stop-color="#1c1712"/><stop offset="1" stop-color="#15130f"/>
  </linearGradient>
  <linearGradient id="rim" x1="64" y1="54" x2="448" y2="458" gradientUnits="userSpaceOnUse">
    <stop stop-color="#c97a3a" stop-opacity="0.55"/><stop offset="1" stop-color="#7a4a22" stop-opacity="0.55"/>
  </linearGradient>
  <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 256) rotate(90) scale(170)">
    <stop stop-color="#c97a3a" stop-opacity="0.40"/><stop offset="1" stop-color="#c97a3a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="screen" x1="188" y1="98" x2="324" y2="250" gradientUnits="userSpaceOnUse">
    <stop stop-color="#241f18"/><stop offset="1" stop-color="#15130f"/>
  </linearGradient>
  <linearGradient id="gold" x1="202" y1="188" x2="318" y2="280" gradientUnits="userSpaceOnUse">
    <stop stop-color="#c97a3a"/><stop offset="1" stop-color="#a85a2a"/>
  </linearGradient>
  <linearGradient id="silver" x1="210" y1="178" x2="314" y2="270" gradientUnits="userSpaceOnUse">
    <stop stop-color="#f6f1e7"/><stop offset="1" stop-color="#a79c87"/>
  </linearGradient>`;

// The mark, authored around a 512-box, centred vertically (translate +52).
const MARK = `
  <g transform="translate(0,52)">
    <circle cx="256" cy="182" r="150" fill="url(#glow)"/>
    <rect x="178" y="86" width="156" height="214" rx="40" fill="#0f0c08" stroke="#5a3a20" stroke-width="4"/>
    <rect x="191" y="100" width="130" height="170" rx="30" fill="url(#screen)"/>
    <circle cx="256" cy="286" r="8" fill="#a79c87"/>
    <circle cx="256" cy="182" r="64" fill="#0f0c08" stroke="#c97a3a" stroke-width="4"/>
    <path d="M233 152C239 145 247 141 255 141C270 141 282 149 286 162" stroke="url(#silver)" stroke-width="9" stroke-linecap="round"/>
    <path d="M275 152L291 162L278 176" stroke="url(#gold)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M280 212C274 220 266 224 257 224C243 224 230 216 226 203" stroke="url(#silver)" stroke-width="9" stroke-linecap="round"/>
    <path d="M237 212L221 202L234 188" stroke="url(#gold)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="196" cy="120" r="14" fill="#7fa37a" fill-opacity="0.16" stroke="#7fa37a"/>
    <circle cx="319" cy="243" r="12" fill="#c97a3a" fill-opacity="0.16" stroke="#c97a3a"/>
  </g>`;

// 512x512 square app logo — non-white bg, no text.
const logoSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}</defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <rect x="42" y="42" width="428" height="428" rx="108" fill="#0f0c08" stroke="url(#rim)" stroke-width="4"/>
  ${MARK}
</svg>`;

// 1035x720 content card (345x240 @3x). No text; bottom 282px (94@3x) kept clear.
const cardSvg = `<svg width="1035" height="720" viewBox="0 0 1035 720" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}
    <linearGradient id="cardbg" x1="0" y1="0" x2="1035" y2="720" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1c1712"/><stop offset="1" stop-color="#15130f"/>
    </linearGradient>
  </defs>
  <rect width="1035" height="720" fill="url(#cardbg)"/>
  <circle cx="517" cy="232" r="300" fill="url(#glow)"/>
  <g transform="translate(133,-135) scale(1.5)">${MARK}</g>
</svg>`;

// 1200x630 link-preview / meta image (text allowed here). Tagline matches
// the App Store description_overview's opening clause so the same claim
// reads identically wherever someone first encounters Tcash.
const metaSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}
    <linearGradient id="metabg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1c1712"/><stop offset="1" stop-color="#15130f"/>
    </linearGradient>
    <linearGradient id="word" x1="640" y1="250" x2="980" y2="330" gradientUnits="userSpaceOnUse">
      <stop stop-color="#e3a466"/><stop offset="1" stop-color="#c97a3a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#metabg)"/>
  <circle cx="330" cy="315" r="300" fill="url(#glow)"/>
  <g transform="translate(74,8) scale(1.05)">${MARK}</g>
  <text x="660" y="292" fill="url(#word)" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="112" font-weight="500">Tcash</text>
  <text x="662" y="358" fill="#a79c87" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500">Kenya's bridge between</text>
  <text x="662" y="398" fill="#a79c87" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500">World App and M-Pesa.</text>
</svg>`;

// 1080x1920 portrait showcase panels (text allowed). Clean, on-brand.
const showcase = (l1, l2, sub) => `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}
    <linearGradient id="scbg" x1="0" y1="0" x2="1080" y2="1920" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1c1712"/><stop offset="1" stop-color="#15130f"/>
    </linearGradient>
    <linearGradient id="scword" x1="120" y1="900" x2="900" y2="1040" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f6f1e7"/><stop offset="1" stop-color="#e3a466"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#scbg)"/>
  <g transform="translate(284,326) scale(1.0)">${MARK}</g>
  <text x="540" y="800" fill="#c97a3a" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" letter-spacing="8" text-anchor="middle">TCASH</text>
  <text x="540" y="1080" fill="url(#scword)" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="800" text-anchor="middle">${l1}</text>
  <text x="540" y="1200" fill="url(#scword)" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="800" text-anchor="middle">${l2}</text>
  <text x="540" y="1310" fill="#a79c87" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="500" text-anchor="middle">${sub}</text>
</svg>`;

const out = (name, svg, w) => {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`wrote public/${name} (${png.length} bytes)`);
};

out("tcash-logo.png", logoSvg, 512);
out("tcash-card.png", cardSvg, 1035);
out("tcash-meta.png", metaSvg, 1200);
out("tcash-showcase-1.png", showcase("Buy &amp; sell", "WLD and USDC", "Trade crypto right inside World App."), 1080);
out("tcash-showcase-2.png", showcase("Cash out to", "M-Pesa", "Receive KES fast after a quick review."), 1080);
out("tcash-showcase-3.png", showcase("Reviewed by", "a real person", "Every order checked before it settles."), 1080);
