# Tcash

Tcash is an independently operated World App mini app for buying and selling WLD or USDC with M-Pesa settlement in Kenya. Payments are reviewed and settled by an operator.

## Product

The interface uses a warm paper background, copper controls, serif money figures, and a readable order ledger. It shows fees before payment, explains manual settlement, provides direct support, and avoids implying World endorsement or identity verification based on a username.

## Trade lifecycle

1. Sign in with World App Wallet Auth after reviewing the terms and data consent. The server verifies SIWE and issues an HTTP-only session.
2. Enter an amount and settlement destination. A server quote calculates quantities, fees, and payout from fresh market data and the shared operator settings.
3. The server saves the pending order in private Redis before showing payment instructions. Amounts and destinations are immutable after creation.
4. Submit an M-Pesa code, or approve World Pay. A successful command result is cached before verification so a lost connection can be recovered without another payment.
5. The app acknowledges payment only after the server accepts the update. Acknowledgment is not settlement. The operator checks payment evidence and makes the payout before marking the order completed.
6. History reloads server records on entry and when the app returns to the foreground. Saved pending orders can be resumed.

## Development and checks

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite serves the frontend. Use the connected Vercel project for `/api/*` routes. Opening a local browser does not verify MiniKit commands; those require World App.

## Required deployment configuration

See `.env.example`. Configure the World App ID, Developer Portal API key, a session signing secret, the operator wallet allowlist, and private Upstash Redis credentials. Configure the World ID RP signing key and matching Developer Portal action for high-value trades. High-value orders fail closed if this feature is unavailable.

Order and World ID records no longer fall back to public Vercel Blob files. Existing public files need an operator-controlled migration and removal; changing this code does not make previously published files private. Redis credentials must be configured before deploying this release.

Optional operator email and World notification credentials enable delivery of notifications. Notification failure does not mean an order failed to save.

## Release status

Code improvements and local checks do not establish World App approval. See `WORLD_MINI_APP_CHECKLIST.md` for configuration, real-device testing, migration, and submission requirements. Production fulfillment and World ID proof generation must be tested with the actual operator setup before release.

## Current review status

See [the strict review](docs/STRICT_WORLD_REVIEW.md) for fixed findings, validation evidence and the required native-device and operator checks. Historical certification reports do not establish World approval.

`npm run check` checks undefined runtime names. Production builds run this check automatically before bundling.
