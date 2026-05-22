# TMpesa World Docs Alignment

This note records the World Developers docs reviewed during the final TMpesa polish pass and the current alignment status.

## Reviewed official pages

- Mini Apps overview: https://docs.world.org/mini-apps/introduction/what-are-mini-apps
- Mini Apps getting started: https://docs.world.org/mini-apps/quick-start/installing
- Mini Apps initialization: https://docs.world.org/mini-apps/quick-start/init
- Mini Apps responses: https://docs.world.org/mini-apps/quick-start/responses
- Wallet authentication: https://docs.world.org/mini-apps/commands/wallet-auth
- Request permission: https://docs.world.org/mini-apps/commands/request-permission
- Get permissions: https://docs.world.org/mini-apps/commands/get-permissions
- Send notifications: https://docs.world.org/mini-apps/commands/how-to-send-notifications
- App guidelines: https://docs.world.org/mini-apps/guidelines/app-guidelines
- World ID overview: https://docs.world.org/world-id/overview

## Current TMpesa alignment

- Wallet Auth is the primary sign-in path.
- MiniKit provider is mounted at app startup.
- Notification permission uses the documented permission flow.
- World push notifications are wired from backend and in-app permission state.
- Navigation is tab-based and mobile-first.
- Home is compact and task-focused instead of landing-page-like.
- Wallet, Trade, History, Profile, Support, and hidden Admin are separated by responsibility.

## Important remaining note

TMpesa still uses the legacy MiniKit verification flow for protected order checks:

- client: `requestWorldVerification(...)`
- backend: `api/verify.js`

World docs now present World ID and IDKit as the current verification direction. If a future strict migration is required, this is the main remaining area to update.
