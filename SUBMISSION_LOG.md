# Tcash — World Mini App Submission Log

**Prepared:** 2026-07-07  
**App ID:** `app_02bd6decc052cfd1dfa2948744af6c6f`  
**GitHub:** `github.com/Jonta254/WorldTMpesa` (being renamed to Tcash)  
**Vercel:** `world-t-mpesa.vercel.app` (production)  
**Contact:** `brianokindo2022@gmail.com`  
**Admin World username:** `@jontAWorld`  

---

## 1. What Tcash Does

Tcash is a World App mini app that bridges WLD and USDC crypto with Kenyan M-Pesa mobile money. Users can:

- **Buy** WLD or USDC by paying KES via M-Pesa PayBill — order confirmed by admin, crypto sent to World wallet
- **Sell** WLD or USDC by sending from World App via World Pay — admin settles KES to the user's M-Pesa number
- **Track** all orders in real time with status updates and World push notifications
- **Invite** other World users with a referral code and earn KES rewards when friends trade

The service is fully manual-review based — no automated on-chain settlement. All payouts are processed by the admin operator.

---

## 2. App Details for Developer Portal

| Field | Value |
|---|---|
| **App name** | Tcash |
| **Short description** | Trade WLD and USDC with M-Pesa settlement inside World App |
| **Long description** | Tcash lets World App users buy and sell WLD and USDC with M-Pesa mobile money in Kenya. Pay by M-Pesa PayBill and receive crypto to your World wallet. Or send crypto via World Pay and receive KES to your M-Pesa number. Live exchange rates, order tracking, World push notifications, and a referral program. |
| **Category** | Finance |
| **Integration URL** | `https://world-t-mpesa.vercel.app` |
| **App ID** | `app_02bd6decc052cfd1dfa2948744af6c6f` |
| **Support email** | `brianokindo2022@gmail.com` |
| **World Pay receiver wallet** | `0x6588e8765c495a9d44e93b0293aedd7ecd6167fc` |

---

## 3. MiniKit Commands Used

| Command | Where | Purpose |
|---|---|---|
| `walletAuth` | LoginPage | Sign in with World wallet — full SIWE flow with server nonce |
| `pay` | SellPage | In-app WLD/USDC send to Tcash receiver wallet |
| `requestPermission` | AppShell | Request notification permission on first entry |
| `getPermissions` | AppShell | Check existing notification permission state |
| `sendHapticFeedback` | All pages | Feedback on button taps, order confirmation, saves |
| `closeMiniApp` | AppShell Exit | Gracefully close the mini app on logout |
| `share` | Dashboard / Profile | Share referral invite link |

All commands are called via `MiniKit.commandsAsync` (documented async API). Every command has a graceful fallback for browser preview mode outside World App.

---

## 4. Backend API Routes (Vercel Serverless)

All routes live under `/api/` and run as Vercel Node.js functions.

| Route | Method | Purpose |
|---|---|---|
| `GET /api/nonce` | GET | Create HMAC-signed server nonce for SIWE |
| `POST /api/complete-siwe` | POST | Verify World wallet auth payload server-side |
| `POST /api/payment-reference` | POST | Issue a unique payment reference before World Pay |
| `POST /api/confirm-payment` | POST | Confirm World Pay transaction with Developer Portal API |
| `GET /api/orders` | GET | Load shared admin order queue from Vercel Blob |
| `POST /api/orders` | POST | Save new or updated order to Vercel Blob |
| `POST /api/notify-order` | POST | Send admin email notification via Resend |
| `POST /api/notify-referral` | POST | Send admin referral event email |
| `POST /api/send-world-notification` | POST | Send World push notification to user or admin |
| `GET /api/world-prices` | GET | Fetch live WLD/USDC/KES rates from CoinGecko + Binance |
| `GET /api/health` | GET | Backend health check — confirms env vars configured |

---

## 5. Environment Variables Required

| Variable | Purpose | Where to get |
|---|---|---|
| `APP_ID` | World mini app ID for payment verification | World Developer Portal |
| `VITE_WORLD_APP_ID` | Build-time app ID baked into frontend bundle | Same as APP_ID |
| `DEV_PORTAL_API_KEY` | Authenticate with World Developer Portal API | World Developer Portal → API Keys |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for shared admin order queue | Vercel Dashboard → Storage → Blob |
| `RESEND_API_KEY` | Admin email notifications via Resend | resend.com |
| `ORDER_NOTIFICATION_EMAIL` | Admin email for new order alerts | `brianokindo2022@gmail.com` |
| `ORDER_EMAIL_FROM` | Verified sender for Resend | `Tcash <onboarding@resend.dev>` |
| `ADMIN_WORLD_WALLET` | Admin wallet for World push notifications | `0x6588e8765c495a9d44e93b0293aedd7ecd6167fc` |

All variables are set in Vercel → Project Settings → Environment Variables.

---

## 6. App Screen Inventory

### Auth
- **Login** — World wallet auth button (primary), referral code auto-detected from URL params

### Home (Dashboard)
- Premium hero card: T brand mark + Tcash name + World verified chip + avatar
- Time-aware greeting + @username
- Live KES portfolio balance with refresh
- WLD and USDC asset chips with live rates
- 4 quick action buttons: Buy · Sell · Receive · History
- Recent orders (2 most recent, links to History)
- Referral strip: invite code + share button

### Trade
- **Buy tab** — KES amount input → live quote → M-Pesa PayBill instructions → submit M-Pesa code → order success screen
- **Sell tab** — crypto amount input → live quote → World Pay (in-app send) → order success screen

### History (Orders)
- Filter tabs: All · Pending · Done · Failed with live count badges
- Premium OrderCard: type badge, figures grid, 3-step progress timeline

### Wallet
- World wallet address display with copy
- WLD and USDC balances with KES value
- Live rates per asset

### Profile
- World username + verification status
- M-Pesa payout number management
- Notification permission toggle
- Referral summary: code, invited count, reward status, claim
- App rating
- Theme toggle (dark/light)
- Support links (email, WhatsApp)
- Legal links: User Guidelines · Terms · Privacy Policy
- Logout

### Support
- Accordion guide: Getting started · Buy · Sell · Delays
- Email and WhatsApp support buttons
- Legal links: User Guidelines · Terms · Privacy Policy

### Guidelines (`/guidelines`)
- Full in-app user guidelines: eligibility, order flow, responsibilities, referral rules, disputes, risk disclosure, trade limits
- Links to Terms and Privacy Policy

### Admin (`/tcash-admin`, `/tmpesa-admin`, `/admin`)
- Password-gated operator desk
- Live order queue (shared via Vercel Blob, refreshes every 10s)
- Mark Paid · Mark Completed · Mark Failed per order
- Live WLD/USDC rate display
- Fee and operational settings

---

## 7. World Developer Docs Compliance

| Requirement | Status | Notes |
|---|---|---|
| App name does not contain "World" | ✅ | Name is "Tcash" |
| MiniKit installed via `MiniKitProvider` | ✅ | `SafeMiniKitProvider` wraps entire app with `appId` |
| Wallet Auth uses server nonce | ✅ | HMAC-signed nonce, cookie + signature dual validation |
| SIWE verified server-side | ✅ | `/api/complete-siwe` uses `verifySiweMessage` from `@worldcoin/minikit-js` |
| Pay command uses backend reference | ✅ | `/api/payment-reference` issues reference before each pay command |
| Pay result verified with Developer Portal | ✅ | `/api/confirm-payment` calls `developer.worldcoin.org/api/v2/minikit/transaction` |
| Pay status "unknown"/"pending" treated as submitted | ✅ | Only "failed"/"reverted" block the flow |
| Notifications use `localisations` array | ✅ | `{ localisations: [{ language: "en", title, message }] }` |
| Notification deep link uses `worldapp://mini-app` format | ✅ | `worldapp://mini-app?app_id=...&path=...` |
| `commandsAsync` used for all MiniKit calls | ✅ | Checked first, falls back to legacy for compatibility |
| `finalPayload` read from command results | ✅ | `finalPayload` checked before `.data` |
| Haptic feedback on key interactions | ✅ | `sendHapticFeedback` on submit, confirm, save, exit |
| `closeMiniApp` on logout | ✅ | Calls World close command, falls back to navigate |
| Safe area insets applied | ✅ | `deviceProperties.safeAreaInsets` applied to page-bg |
| `viewport-fit=cover` in HTML | ✅ | `index.html` meta viewport includes `viewport-fit=cover` |
| Mini app share uses `share` command | ✅ | `MiniKit.commandsAsync.share` with title, text, url |
| App icon: PNG 512×512 | ✅ | `public/tcash-logo.png` |
| App content card / banner images | ✅ | `public/portal-hero.jpg`, `portal-content-card.jpg`, `portal-showcase-*.jpg` |
| Privacy Policy published | ✅ | `/privacy.html` — standalone static page |
| Terms & Conditions published | ✅ | `/terms.html` — standalone static page |
| User Guidelines published | ✅ | `/guidelines.html` + in-app `/guidelines` route |
| Support contact provided | ✅ | `brianokindo2022@gmail.com` + WhatsApp in-app |

---

## 8. Security

| Area | Implementation |
|---|---|
| SIWE nonce | HMAC-SHA256 signed with `DEV_PORTAL_API_KEY`, cookie + signature dual validation |
| Payment reference | Server-issued UUID stored in httpOnly cookie, verified on confirm |
| Timing-safe comparison | `timingSafeEqual` used for nonce signature check |
| Admin route | Password-gated locally — `/tcash-admin`, `/tmpesa-admin`, `/admin` all resolve to AdminPage |
| CORS | `Access-Control-Allow-Origin: *` on `/api/*` for World App WebView |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` |
| Blob storage | Public read (order blobs are non-sensitive), write requires `BLOB_READ_WRITE_TOKEN` |

---

## 9. Known Limitations (Prototype)

- **Manual settlement** — All KES payouts and crypto releases are processed manually by the admin.
- **Local user storage** — User accounts stored in browser localStorage. No cross-device sync (World wallet address provides de-facto identity).
- **Single admin desk** — One operator manages all orders.
- **Receiver wallet whitelisting** — World Developer Portal requires the sell receiver wallet (`0x6588e8…`) to be whitelisted before live World Pay transactions are accepted.
- **Resend free tier** — Email notifications limited to 100/day. Upgrade plan for production volume.

---

## 10. Pre-Submission Checklist

- [x] App name: "Tcash" — no "World" in the name
- [x] Integration URL set in Developer Portal: `https://world-t-mpesa.vercel.app`
- [x] All env vars set in Vercel production
- [x] `APP_ID` matches Developer Portal app ID
- [x] Receiver wallet `0x6588e8…` whitelisted in Developer Portal for World Pay
- [x] App icon uploaded: 512×512 PNG (`tcash-logo.png`)
- [x] Content card / showcase images uploaded
- [x] Short and long descriptions written (see Section 2)
- [x] Support email set: `brianokindo2022@gmail.com`
- [x] Health endpoint responding: `GET /api/health`
- [x] Privacy Policy live: `/privacy.html`
- [x] Terms & Conditions live: `/terms.html`
- [x] User Guidelines live: `/guidelines.html` + in-app `/guidelines`
- [x] Legal links accessible from Profile and Support pages
- [x] All `tmpesa-icon.svg` references replaced with `tcash-logo.png`
- [x] Build passing: `npm run build` — 0 errors, 0 warnings
- [ ] Rebuild and push to Vercel (run `npm run build` then push to GitHub)
- [ ] Submit app for World review in Developer Portal
- [ ] Whitelist receiver wallet in Developer Portal (if not done)
- [ ] Rename GitHub repo from WorldTMpesa to Tcash
- [ ] Upgrade Resend plan for production email volume
