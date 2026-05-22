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
- Bottom navigation is always visible and kept short.
- Large landing-page style sections were removed from the main app flow.
- Support contact paths are present and reachable from inside the app.
- The app keeps clear direct navigation without hamburger menus.
- Trade, Wallet, History, Profile, and Support use single-purpose screens instead of mixing roles.

## World ID verification status

TMpesa now uses the current World ID / IDKit flow as the primary path for protected verification:

- backend RP context route: `api/world-id-rp-context.js`
- backend proof verification route: `api/verify.js`
- client verification entry: `requestWorldVerification(...)`

Temporary fallback remains:

- if `WORLD_RP_ID` or `RP_SIGNING_KEY` is not configured, TMpesa falls back to the legacy MiniKit verify path so existing environments do not break immediately

For a fully strict production setup, configure:

- `WORLD_RP_ID`
- `RP_SIGNING_KEY`
