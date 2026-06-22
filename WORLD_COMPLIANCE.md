# TMpesa — World Mini App Compliance Checklist

Tracks TMpesa against the official World Developer guidelines, reviewed for the
re-submission after the "app quality is too low / follow design and app
guidelines" rejection.

## Authoritative sources reviewed (current)

- App (review) guidelines: https://docs.world.org/mini-apps/design/app-guidelines
- App review policy: https://docs.world.org/mini-apps/guidelines/policy
- Notifications guidelines: https://docs.world.org/mini-apps/notifications/features-and-guidelines
- Commands (pay, wallet-auth, permissions, etc.): https://docs.world.org/mini-apps/commands/*
- UI Kit: `@worldcoin/mini-apps-ui-kit-react` (NPM)

Legend: ✅ done · ⚠️ partial / verify in World App · ⛔ owner action required (dev portal or business decision)

---

## A. Design guidelines

| # | Guideline | Status | Notes |
|---|-----------|--------|-------|
| A1 | Tab navigation; no hamburger / footer / sidebar | ✅ | Bottom tab bar (Home / Wallet / Trade / History); no hamburger or sidebar anywhere. |
| A2 | Avoid excessive scrolling; compact, task-focused screens | ✅ | Removed duplicate stacked headers on the Trade flow so the Buy/Sell form reaches the fold; Home decluttered. Verified in a 375×812 mobile preview. |
| A3 | Mobile-first, responsive across screen sizes | ✅ | Single-column mobile layouts, safe-area aware padding. |
| A4 | Mobile-optimized fonts | ✅ | Switched to native system stack (`-apple-system, Roboto, system-ui…`) — resolves to SF Pro / Roboto on device. Was Windows-only `Segoe UI`. |
| A5 | iOS scroll-bounce prevention (`100dvh`, `overscroll-behavior:none`, `-webkit-overflow-scrolling`) | ✅ | Present in `styles.css`; boot fallback in `index.html` moved 100vh → 100dvh. |
| A6 | Snap-to text boxes for input | ✅ | Native inputs with `inputMode` set on numeric fields. |
| A7 | Consistent background colors | ✅ | Single dark theme token set in `:root`. |
| A8 | Splash / sign-in screen when needed | ✅ | `LoginPage` is a dedicated Wallet Auth splash. |
| A9 | Never show wallet addresses as identity; always display username | ✅ | Identity shown as `@username` everywhere. Receive screen shows a truncated own-address + copy (required to receive); removed the redundant full-address line. |
| A10 | App icon: square, non-white background | ⛔ | Confirm `/tmpesa-icon.svg` uploaded in portal is square with a non-white background. |
| A11 | Content card image 345×240, no text, bottom 94px clear, PNG @3x, no metadata | ⛔ | Owner: verify the dev-portal content card asset meets this exact spec. |
| A12 | Performance: initial load 2–3s, actions <1s, visual feedback during loading | ⚠️ | Loading notices present (wallet, auth, order). Verify cold-load time in World App. |
| A13 | No World logo / no modified World marks as primary brand | ✅ | TMpesa uses its own mark; World shown only as "World mini app" labels. |
| A14 | Don't use the word "official" implying World endorsement | ✅ | Removed remaining "official" wording (admin field hint). |

## B. App review policy

| # | Guideline | Status | Notes |
|---|-----------|--------|-------|
| B1 | Live MiniKit/IDKit integration that works in testing | ✅ | Wallet Auth (SIWE) + World Pay + permissions are live, not stubbed. |
| B2 | App is complete & final (not demo/beta), all copy/functionality present | ✅ | Full buy/sell/wallet/history/support flows. Removed the "Coming soon" home strip (Price Alerts / Auto-Sell / Card / Analytics) that advertised unbuilt features — a non-final signal reviewers flag. |
| B3 | No infinite loading; works on poor connections | ✅ | All network calls bounded (12s abort) + tolerant fallbacks; loading states reset in `finally`. |
| B4 | Name: short; no "World"; no generic terms; **no trademarked words / popular-app mimicry (incl. letter/case substitution)** | ⛔ | **DECISION NEEDED.** "TMpesa" reads as the Safaricom trademark "M-Pesa" via letter substitution — a likely rejection trigger. Owner must decide: rebrand to a distinct name, or accept the risk. |
| B5 | Description: plain language, ≤25 words, user-benefit focused | ⛔ | Owner: set the dev-portal short description to ≤25 plain words (see suggestion below). |
| B6 | Data collection requires user consent; only collect relevant data | ⚠️ | App collects phone + M-Pesa number for settlement (relevant). Notification permission uses the documented request flow. Owner: ensure a privacy policy + in-portal data disclosure. |
| B7 | Valid support email / reachable channel | ✅ | Support email + WhatsApp link reachable in-app (Support page). |
| B8 | Regulatory compliance in all target jurisdictions (financial services) | ⛔ | Owner responsibility: crypto↔M-Pesa exchange is regulated in Kenya. Ensure licensing/compliance; World places this on the developer. |
| B9 | No prohibited content (NSFW, hate, weapons, drugs, impersonation, chance-based games) | ✅ | None present. Not a chance/RNG game. |
| B10 | Cross-platform progress sync | ✅ | Orders sync to a shared admin queue (Upstash Redis) keyed by user. |

---

## C. Code changes applied in this pass

- `src/styles.css` + `index.html` — mobile-native system font stack (A4).
- `index.html` — boot fallback `100vh` → `100dvh` (A5).
- `src/pages/app/WalletPage.jsx` — removed redundant full raw wallet address; show `@username` instead (A9).
- `src/pages/app/AdminPage.jsx` — removed "official" wording (A14).
- `src/pages/app/DashboardPage.jsx` — removed the "Coming soon" placeholder-feature strip (B2); fixed home balance chips that clipped the balance (e.g. `21....`) by showing 2 dp and stacking the live rate under the amount (A12 polish). Verified in mobile preview.
- `src/pages/trade/{BuyPage,SellPage}.jsx` — removed the duplicate step-1 headers (TradePage already provides the heading + toggle), so the form reaches the fold with less scrolling (A2).

All changes verified live in a 375×812 dark mobile preview before commit.

## D. Owner action items before re-submitting (dev portal / business)

1. **App name (B4)** — strongly recommended: rebrand away from "TMpesa"/M-Pesa to a distinct, non-trademark name. This is the most probable cause of the design/quality rejection.
2. **Short description (B5)** — set to ≤25 plain words. Suggested: *"Buy and sell WLD or USDC and settle to mobile money, with every order reviewed by a human operator."* (21 words; drop "M-Pesa" if rebranding.)
3. **Icon (A10)** — confirm square, non-white background.
4. **Content card image (A11)** — 345×240, no text, bottom 94px clear, PNG @3x, no metadata.
5. **Screenshots** — current, representative of the final app.
6. **Privacy policy + data disclosure (B6)** — publish and link; disclose phone / M-Pesa number collection.
7. **Regulatory (B8)** — confirm licensing for crypto↔mobile-money exchange in target markets.

## E. Recommended next step (optional, larger)

Adopt the official `@worldcoin/mini-apps-ui-kit-react` for core controls
(buttons, inputs, list items, nav) to match World's native look — the strongest
single signal for a "design quality" re-review. Deferred pending owner go-ahead
(adds a dependency and a component refactor that should be visually verified).
