# TMpesa — World Mini App Submission Log

**Prepared:** 2026-06-07  
**App ID:** `app_02bd6decc052cfd1dfa2948744af6c6f`  
**GitHub:** `github.com/Jonta254/WorldTMpesa`  
**Vercel:** `world-t-mpesa.vercel.app` (production)  
**Contact:** `brianokindo2022@gmail.com`  
**Admin World username:** `@jontAWorld`  

---

## 1. What TMpesa Does

TMpesa is a World App mini app that bridges WLD and USDC crypto with Kenyan M-Pesa mobile money. Users can:

- **Buy** WLD or USDC by paying KES via M-Pesa PayBill — order confirmed by admin, crypto sent to World wallet
- **Sell** WLD or USDC by sending from World App via World Pay — admin settles KES to the user's M-Pesa number
- **Track** all orders in real time with status updates and World push notifications
- **Invite** other World users with a referral code and earn KES rewards when friends trade

The service is fully manual-review based — no automated on-chain settlement. All payouts are processed by the admin operator.

---

## 2. App Details for Developer Portal

| Field | Value |
|---|---|
| **App name** | TMpesa |
| **Short description** | Trade WLD and USDC with M-Pesa settlement inside World App |
| **Long description** | TMpesa lets World App users buy and sell WLD and USDC with M-Pesa mobile money in Kenya. Pay by M-Pesa PayBill and receive crypto to your World wallet. Or send crypto via World Pay and receive KES to your M-Pesa number. Live exchange rates, order tracking, World push notifications, and a referral program. |
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
| `pay` | SellPage | In-app WLD/USDC send to TMpesa receiver wallet |
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
| `ORDER_EMAIL_FROM` | Verified sender for Resend | `TMpesa <onboarding@resend.dev>` |
| `ADMIN_WORLD_WALLET` | Admin wallet for World push notifications | `0x6588e8765c495a9d44e93b0293aedd7ecd6167fc` |

All variables are set in Vercel → Project Settings → Environment Variables.

---

## 6. App Screen Inventory

### Auth
- **Login** — World wallet auth button (primary), local phone/password (dev fallback), referral code auto-detected from URL params
- **Signup** — Local account creation with referral code support

### Home (Dashboard)
- Premium hero card: M logo + TMpesa brand + World verified chip + avatar
- Time-aware greeting + @username
- Live KES portfolio balance with refresh
- WLD and USDC asset chips with live rates
- 4 quick action buttons: Buy · Sell · Receive · History
- Recent orders (2 most recent, links to History)
- Coming soon teaser strip: Price Alerts · Auto-Sell · TMpesa Card · Analytics
- Referral strip: invite code + share button

### Trade
- **Buy tab** — KES amount input → live quote → M-Pesa PayBill instructions → submit M-Pesa code → order success screen
- **Sell tab** — crypto amount input → live quote → World Pay (in-app send) or manual TX hash → order success screen
- Order placed banner (green ✓) appears immediately when order is saved
- Full success screen (step 3): animated check ring, order summary, View in History + New trade

### History (Orders)
- Filter tabs: All · Pending · Done · Failed with live count badges
- Premium OrderCard: type badge, figures grid, 3-step progress timeline
- Buy pending: inline M-Pesa code submission
- Support and Delay buttons per order

### Wallet
- World wallet address display with copy
- WLD and USDC balances with KES value
- Live rates per asset
- Receive section with wallet address

### Profile
- World username + verification status
- M-Pesa payout number management
- Notification permission toggle
- Referral summary: code, invited count, reward status, claim
- App rating
- Theme toggle (dark/light)
- Support links (email, WhatsApp)
- Logout

### Support (Guide)
- Accordion guide: Getting started · Buy · Sell · Delays
- Email and WhatsApp support buttons

### Admin (`/tmpesa-admin`)
- Password-gated operator desk
- Live order queue (shared via Vercel Blob, refreshes every 10s)
- Mark Paid · Mark Completed · Mark Failed per order
- Payout queue for sell orders ready for M-Pesa send
- Live WLD/USDC rate display
- Fee per coin settings (editable)
- Operational settings: receiver wallet, M-Pesa PayBill, support email
- Referral claim approval and payout tracking
- Admin alert feed (order created, referral milestones)

---

## 7. World Developer Docs Compliance

| Requirement | Status | Notes |
|---|---|---|
| App name does not contain "World" | ✅ | Name is "TMpesa" |
| MiniKit installed via `MiniKitProvider` | ✅ | `SafeMiniKitProvider` wraps entire app with `appId` |
| Wallet Auth uses server nonce | ✅ | HMAC-signed nonce, cookie + signature dual validation |
| SIWE verified server-side | ✅ | `/api/complete-siwe` uses `verifySiweMessage` from `@worldcoin/minikit-js` |
| Pay command uses backend reference | ✅ | `/api/payment-reference` issues reference before each pay command |
| Pay result verified with Developer Portal | ✅ | `/api/confirm-payment` calls `developer.worldcoin.org/api/v2/minikit/transaction` |
| Pay status "unknown"/"pending" treated as submitted | ✅ | Fixed — only "failed"/"reverted" block the flow |
| Notifications use `localisations` array | ✅ | `{ localisations: [{ language: "en", title, message }] }` |
| Notification deep link uses `worldapp://mini-app` format | ✅ | `worldapp://mini-app?app_id=...&path=...` |
| `commandsAsync` used for all MiniKit calls | ✅ | Checked first, falls back to legacy for compatibility |
| `finalPayload` read from command results | ✅ | Fixed — `finalPayload` checked before `.data` |
| Haptic feedback on key interactions | ✅ | `sendHapticFeedback` on submit, confirm, save, exit |
| `closeMiniApp` on logout | ✅ | Calls World close command, falls back to navigate |
| Safe area insets applied | ✅ | `deviceProperties.safeAreaInsets` applied to page-bg |
| `viewport-fit=cover` in HTML | ✅ | `index.html` meta viewport includes `viewport-fit=cover` |
| Mini app share uses `share` command | ✅ | `MiniKit.commandsAsync.share` with title, text, url |
| App icon: PNG 512×512 | ✅ | `public/tmpesa-icon.png` (88 KB) |
| App content card / banner images | ✅ | `public/portal-hero.jpg`, `portal-content-card.jpg`, `portal-showcase-*.jpg` |

---

## 8. Security

| Area | Implementation |
|---|---|
| SIWE nonce | HMAC-SHA256 signed with `DEV_PORTAL_API_KEY`, cookie + signature dual validation |
| Payment reference | Server-issued UUID stored in httpOnly cookie, verified on confirm |
| Timing-safe comparison | `timingSafeEqual` used for nonce signature check |
| Admin route | Password-gated locally, no server-side admin auth (acceptable for manual-review model) |
| CORS | `Access-Control-Allow-Origin: *` on `/api/*` for World App WebView |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` |
| Blob storage | Public read (order blobs are non-sensitive), write requires `BLOB_READ_WRITE_TOKEN` |

---

## 9. Commit History (Key Milestones)

```
d153a37  feat: coming soon teaser strip + World docs command fix
522bee2  fix: remove invalid runtime from vercel.json — was crashing every deploy
dd1bf8c  fix: compact home — fits screen without long scrolling
0ae6d68  feat: premium home hero card — unified brand + balance + actions
f97a49b  fix: accept pending/unknown World Pay status as valid
06c4b07  feat: premium home, shell, orders and order success screens
a69978d  fix: remove double header, dedupe admin notifications
f302a82  feat: premium dashboard — compact above-fold layout
97f24b9  chore: add improved TMpesa portal logo v2
4420abf  feat: premium hero profile card + World portal images
660e9c8  Premium Home redesign
d4fb940  Add vercel.json: SPA rewrites, API routing, security headers
841b4b3  World docs compliance: notification format, haptics, close command
fd6e888  Full layout and spacing polish
9009648  Fix 7 real bugs: API URL, duplicate notifications, appId, safe area
```

---

## 10. Known Limitations (Prototype)

- **Manual settlement** — All KES payouts and crypto releases are processed manually by the admin. No automated blockchain settlement.
- **Local user storage** — User accounts stored in browser localStorage. No cross-device account sync (wallet address + username from World App provides de-facto identity).
- **Single admin desk** — One operator manages all orders. No multi-admin support.
- **Receiver wallet whitelisting** — World Developer Portal requires the sell receiver wallet (`0x6588e8…`) to be whitelisted before live World Pay transactions are accepted.
- **Resend free tier** — Email notifications limited to 100/day on free plan. Upgrade Resend plan for production volume.

---

## 11. Pre-Submission Checklist

- [x] App name: "TMpesa" — no "World" in the name
- [x] Integration URL set in Developer Portal: `https://world-t-mpesa.vercel.app`
- [x] All env vars set in Vercel production
- [x] `APP_ID` matches Developer Portal app ID
- [x] Receiver wallet `0x6588e8…` whitelisted in Developer Portal for World Pay
- [x] App icon uploaded: 512×512 PNG
- [x] Content card / showcase images uploaded
- [x] Short and long descriptions written (see Section 2)
- [x] Support email set: `brianokindo2022@gmail.com`
- [x] Health endpoint responding: `GET /api/health`
- [x] Build passing: `npm run build` — 0 errors, 0 warnings
- [x] Vercel deployment: READY (commit `d153a37`)
- [ ] Submit app for World review in Developer Portal
- [ ] Whitelist receiver wallet in Developer Portal (if not done)
- [ ] Upgrade Resend plan for production email volume
