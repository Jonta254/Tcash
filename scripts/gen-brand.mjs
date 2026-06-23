// Generates clean, text-free Tcash brand PNGs for the World Dev Portal.
// Run: node scripts/gen-brand.mjs  (needs @resvg/resvg-js available)
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

// Shared defs (gradients) + the phone/exchange mark, faithful to the app icon
// but with NO wordmark text (World prefers clean, text-free icons).
const DEFS = `
  <linearGradient id="bg" x1="42" y1="26" x2="470" y2="482" gradientUnits="userSpaceOnUse">
    <stop stop-color="#061024"/><stop offset="1" stop-color="#122448"/>
  </linearGradient>
  <linearGradient id="rim" x1="64" y1="54" x2="448" y2="458" gradientUnits="userSpaceOnUse">
    <stop stop-color="#314F84"/><stop offset="1" stop-color="#172949"/>
  </linearGradient>
  <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 256) rotate(90) scale(170)">
    <stop stop-color="#2FF1FF" stop-opacity="0.40"/><stop offset="1" stop-color="#2FF1FF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="screen" x1="188" y1="98" x2="324" y2="250" gradientUnits="userSpaceOnUse">
    <stop stop-color="#163061"/><stop offset="1" stop-color="#0D1831"/>
  </linearGradient>
  <linearGradient id="gold" x1="202" y1="188" x2="318" y2="280" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFE5A8"/><stop offset="1" stop-color="#D6A33B"/>
  </linearGradient>
  <linearGradient id="silver" x1="210" y1="178" x2="314" y2="270" gradientUnits="userSpaceOnUse">
    <stop stop-color="#F9FCFF"/><stop offset="1" stop-color="#A3B2C8"/>
  </linearGradient>`;

// The mark, authored around a 512-box, centred vertically (translate +52).
const MARK = `
  <g transform="translate(0,52)">
    <circle cx="256" cy="182" r="150" fill="url(#glow)"/>
    <rect x="178" y="86" width="156" height="214" rx="40" fill="#091425" stroke="#31507E" stroke-width="4"/>
    <rect x="191" y="100" width="130" height="170" rx="30" fill="url(#screen)"/>
    <circle cx="256" cy="286" r="8" fill="#8EA5CD"/>
    <circle cx="256" cy="182" r="64" fill="#081320" stroke="#2EEFFF" stroke-width="4"/>
    <path d="M233 152C239 145 247 141 255 141C270 141 282 149 286 162" stroke="url(#silver)" stroke-width="9" stroke-linecap="round"/>
    <path d="M275 152L291 162L278 176" stroke="url(#gold)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M280 212C274 220 266 224 257 224C243 224 230 216 226 203" stroke="url(#silver)" stroke-width="9" stroke-linecap="round"/>
    <path d="M237 212L221 202L234 188" stroke="url(#gold)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="196" cy="120" r="14" fill="#C6FFF2" fill-opacity="0.14" stroke="#73F6C9"/>
    <circle cx="319" cy="243" r="12" fill="#FFE4A5" fill-opacity="0.14" stroke="#E7BA58"/>
  </g>`;

// 512x512 square app logo — non-white bg, no text.
const logoSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}</defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <rect x="42" y="42" width="428" height="428" rx="108" fill="#0A1428" stroke="url(#rim)" stroke-width="4"/>
  ${MARK}
</svg>`;

// 1035x720 content card (345x240 @3x). No text; bottom 282px (94@3x) kept clear.
const cardSvg = `<svg width="1035" height="720" viewBox="0 0 1035 720" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}
    <linearGradient id="cardbg" x1="0" y1="0" x2="1035" y2="720" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0A1730"/><stop offset="1" stop-color="#0B0F1A"/>
    </linearGradient>
  </defs>
  <rect width="1035" height="720" fill="url(#cardbg)"/>
  <circle cx="517" cy="232" r="300" fill="url(#glow)"/>
  <g transform="translate(133,-135) scale(1.5)">${MARK}</g>
</svg>`;

// 1200x630 link-preview / meta image (text allowed here).
const metaSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}
    <linearGradient id="metabg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0A1730"/><stop offset="1" stop-color="#0B0F1A"/>
    </linearGradient>
    <linearGradient id="word" x1="640" y1="250" x2="980" y2="330" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7DE0C0"/><stop offset="1" stop-color="#9AE7FF"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#metabg)"/>
  <circle cx="330" cy="315" r="300" fill="url(#glow)"/>
  <g transform="translate(74,8) scale(1.05)">${MARK}</g>
  <text x="660" y="300" fill="url(#word)" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="800">Tcash</text>
  <text x="662" y="372" fill="#9FB1D1" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Crypto to mobile-money cash.</text>
</svg>`;

const out = (name, svg, w) => {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`wrote public/${name} (${png.length} bytes)`);
};

out("tcash-logo.png", logoSvg, 512);
out("tcash-card.png", cardSvg, 1035);
out("tcash-meta.png", metaSvg, 1200);
