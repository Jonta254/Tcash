# TMpesa World Docs Alignment

This note records the World Developers docs reviewed during the final TMpesa polish pass and the current alignment status.

## Reviewed official pages

- Mini Apps overview: https://docs.world.org/mini-apps/introduction/what-are-mini-apps
- Mini Apps getting started: https://docs.world.org/mini-apps/quick-start/installing
- Mini Apps initialization: https://docs.world.org/mini-apps/quick-start/init
- Mini Apps responses: https://docs.world.org/mini-apps/quick-start/responses
- Commands overview: https://docs.world.org/mini-apps/quick-start/commands
- Wallet authentication: https://docs.world.org/mini-apps/commands/wallet-auth
- Pay: https://docs.world.org/mini-apps/commands/pay
- Send transaction: https://docs.world.org/mini-apps/commands/send-transaction
- Share: https://docs.world.org/mini-apps/commands/share
- World Chat: https://docs.world.org/mini-apps/commands/chat
- Request permission: https://docs.world.org/mini-apps/commands/request-permission
- Get permissions: https://docs.world.org/mini-apps/commands/get-permissions
- Send notifications: https://docs.world.org/mini-apps/commands/how-to-send-notifications
- App guidelines: https://docs.world.org/mini-apps/guidelines/app-guidelines
- Design guidelines: https://docs.world.org/mini-apps/guidelines/design-guidelines
- Policy guidelines: https://docs.world.org/mini-apps/guidelines/policy
- World ID overview: https://docs.world.org/world-id/overview
- Verify migration note: https://docs.world.org/mini-apps/commands/verify

## Current TMpesa alignment

- Wallet Auth is the primary sign-in path.
- MiniKit provider is mounted at app startup.
- Async MiniKit command handling is centralized.
- Notification permission uses the documented permission flow.
- World push notifications are wired from backend and in-app permission state.
- Share and World Chat invite paths are present for referrals.
- World Pay is used for supported sell-side flows, with backend confirmation.
- Navigation is tab-based and mobile-first.
- Home is compact and task-focused instead of landing-page-like.
- Pages are separated by responsibility: Home, Wallet, Trade, History, Profile, Support, hidden Admin.
- App keeps its own brand identity instead of using World branding as the primary UI brand.
- Inputs and navigation are mobile-first and safe-area aware.
- Wallet, Trade, History, Profile, Support, and hidden Admin are separated by responsibility.

## Design and policy notes applied

- Home is intentionally brief and action-focused.
- Home uses compact summary cards instead of tall landing-page sections.
- Bottom navigation is always visible and kept short.
- Large landing-page style sections were removed from the main app flow.
- Support contact paths are present and reachable from inside the app.
- The app keeps clear direct navigation without hamburger menus.
- Trade, Wallet, History, Profile, and Support use single-purpose screens instead of mixing roles.
- User-facing copy avoids implying World endorsement through words like "official" in primary UI messaging.
- Header, spacing, and card hierarchy are tuned for mobile-first use with compact controls and shorter copy.

## Login and verification status

TMpesa uses World Mini App Wallet Auth as the login path, matching the current Wallet Auth docs for mini apps.

- backend nonce route: `api/nonce.js`
- backend SIWE verification route: `api/complete-siwe.js`
- client login entry: `connectWithWorldAppWallet(...)`

World ID / IDKit is not used as a login gate. The World docs say not to use World ID verification as a login substitute, so TMpesa no longer shows a first-access or unlock-trading verification panel.
