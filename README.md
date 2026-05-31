# WorldTMpesa

This repository contains `TMpesa`, a React + Vite World mini app for manually exchanging WLD/USDC and Kenyan Shillings through M-Pesa. It includes Vercel API functions for backend nonce generation, SIWE verification, World payment verification, order notifications, and a shared admin order queue.

## Features

- Local signup and login
- World App wallet-auth entry path
- Dashboard with quick actions
- Sell flow: crypto to KES with in-mini-app WLD send
- Buy flow: M-Pesa to crypto
- Orders page with status tracking
- Admin page for manual confirmation and M-Pesa payout tracking
- Admin-editable rates, receiver wallet, M-Pesa details, and support email
- Gmail support and payment-delay actions for users
- Vercel API backend for nonce generation, SIWE verification, World payment confirmation, and shared admin orders

## Product Context

- Built to run as a World App mini app with MiniKit integration
- Keeps a browser preview mode so the UI can still be tested outside World App
- Uses World App wallet auth as the preferred entry path, with local login only as a fallback for development
- Uses World `Pay` for the WLD sell flow inside the mini app when opened in World App
- Includes repo assets in `public/` for favicon, icon, manifest, and content-card placeholder
- World wallet auth now uses a backend nonce and server-side SIWE verification
- WLD sell payments now call a backend confirmation endpoint before the app records the send
- User profiles and settings still use localStorage, while orders are synced to a shared Vercel Blob admin queue

## Important Prototype Note

- Before production payouts, whitelist the receiver wallet in the World Developer Portal
- Set up Vercel Blob through `BLOB_READ_WRITE_TOKEN` before accepting live orders, so every user order appears in admin across devices
- World recommends Wallet Auth as the primary login flow for mini apps and backend verification for the returned payloads, which this project now implements through Vercel API routes

## Review-Safe Naming

- The repository remains `WorldTMpesa` for continuity
- The in-app display name is `TMpesa` because World's review guidelines say mini app names should not use `World`

## Source Structure

- `src/config`: app-level constants and storage keys
- `src/services`: auth, orders, local storage, and World App integration
- `src/hooks`: shared UI logic such as the order flow state machine
- `src/routes`: top-level route definitions
- `src/components/auth`: auth-only reusable UI
- `src/components/layout`: shell and route protection
- `src/components/orders`: order cards and status display
- `src/pages/auth`: login and signup screens
- `src/pages/app`: dashboard, orders, and admin screens
- `src/pages/trade`: buy and sell transaction flows

## Local Storage Notes

- Users are stored locally in the browser
- Orders are synced to Vercel Blob and cached locally in the current browser
- Rates and app settings are stored locally in the browser
- Orders are cached locally for the current browser and synced through `/api/orders` for the admin desk

## Backend Routes

- `GET /api/nonce`: create a backend nonce for SIWE
- `POST /api/complete-siwe`: verify the World wallet auth payload on the server
- `POST /api/payment-reference`: issue a backend payment reference before WLD send
- `POST /api/confirm-payment`: confirm a World payment with the Developer Portal API
- `GET /api/orders`: load the shared admin order queue
- `POST /api/orders`: save a new or updated order to the shared admin order queue
- `GET /api/health`: quick backend health/config check

## Environment Variables

Create env vars from [.env.example](C:/Users/ADMIN/Documents/New%20project/WorldTMpesa/.env.example):

- `APP_ID`: your World mini app id, used for payment verification
- `DEV_PORTAL_API_KEY`: World Developer Portal API key, used to confirm World payments
- `BLOB_READ_WRITE_TOKEN`: required Vercel Blob token for the shared admin order queue
- `RESEND_API_KEY`: optional Resend key for sending admin order notification emails
- `ORDER_NOTIFICATION_EMAIL`: optional admin email override, defaults to `brianokindo2022@gmail.com`
- `ORDER_EMAIL_FROM`: optional verified sender, defaults to Resend test sender

## Demo Admin Account

- Phone: `0795621901`
- Password: `Jonta@2003`

## Run Locally

1. Install dependencies with `npm install`
2. For frontend-only preview, start the app with `npm run dev`
3. For full backend testing, run through Vercel so `/api/*` routes are available
4. Open the deployed URL inside World App when you want to test MiniKit behavior

## GitHub Ready

This folder is prepared to be pushed to GitHub.

- `node_modules` and build output are ignored in [.gitignore](C:/Users/ADMIN/Documents/Codex/2026-04-19-i-need-to-star-a-new/.gitignore)
- The project root is already cleanly structured for a repo
- You can initialize git and push as soon as `git` is installed on your machine

### Quick Start With Git

If `git` is available on your machine, run:

```bash
git init
git add .
git commit -m "Initial commit for WorldTMpesa"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Open In Editor

If VS Code is installed, you can open the project with:

```bash
code .
```

### GitHub Desktop Option

If you prefer GitHub Desktop:

1. Add this folder as an existing repository after running `git init`
2. Publish the repository to GitHub from GitHub Desktop
3. Continue syncing changes visually

## Stack

- React
- React Router
- Vite
- MiniKit
- localStorage
