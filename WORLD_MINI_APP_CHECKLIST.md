# TMpesa World Mini App Checklist

This app is built as a World App Mini App first. The normal web URL is only for testing and Vercel preview.

## Implemented in the Repo

- MiniKit is installed through `@worldcoin/minikit-js`.
- The React root installs MiniKit through `SafeMiniKitProvider`, which calls `MiniKit.install()` without crashing the World App WebView.
- Login prefers World Wallet Auth and verifies SIWE through `/api/complete-siwe`.
- Sell-side in-app crypto sending uses the World Pay command.
- Payment references are created server-side through `/api/payment-reference`.
- World Pay results are verified through `/api/confirm-payment`.
- Supported World Pay assets are `WLD` and `USDC`.
- The receiver wallet is `0x0f029f35a9da4043ff84b2c98a023d0a68eb64b4`.
- The M-Pesa till number is `5698981`.
- The support email is `brianokindo2022@gmail.com`.
- Delay support can open WhatsApp from the order flow.
- Admin order email notifications are sent through `/api/notify-order` when `RESEND_API_KEY` is configured.
- World notification permission and send hooks are available for in-app user alerts.
- Browser preview mode remains available for testing outside World App.

## Required World Developer Portal Setup

- World App ID captured from Developer Portal: `app_02bd6decc052fc1dfa29487444f6c6f`.
- Set `APP_ID` and `VITE_WORLD_APP_ID` in Vercel to `app_02bd6decc052fc1dfa29487444f6c6f`.
- Create a Developer Portal API key and set it as `DEV_PORTAL_API_KEY` in Vercel.
- Set `RESEND_API_KEY` in Vercel so Gmail order notifications send to admin.
- Set `ORDER_NOTIFICATION_EMAIL` to `brianokindo2022@gmail.com`.
- If using World user push notifications, set `WORLD_NOTIFICATION_API_KEY`.
- Whitelist the receiver wallet address for World Pay.
- Configure app name as `TMpesa`, not `WorldTMpesa`, to avoid implying official World affiliation.
- Upload the app icon and content card/banner assets from `public/`, or replace them with final PNG exports.
- Test the production Vercel URL inside World App using the official Mini App testing QR flow.

## Official Docs Used

- MiniKit installation and provider: https://docs.world.org/mini-apps/quick-start/installing
- Mini App initialization context: https://docs.world.org/mini-apps/quick-start/init
- Commands overview: https://docs.world.org/mini-apps/quick-start/commands
- Wallet Auth: https://docs.world.org/mini-apps/commands/wallet-auth
- Request Permission: https://docs.world.org/mini-apps/commands/request-permission
- Get Permissions: https://docs.world.org/mini-apps/commands/get-permissions
- Send Notifications: https://docs.world.org/mini-apps/commands/how-to-send-notifications
- Pay command and backend verification: https://docs.world.org/mini-apps/commands/pay
- Testing Mini Apps: https://docs.world.org/mini-apps/quick-start/testing
- App guidelines: https://docs.world.org/mini-apps/guidelines/app-guidelines
- Quick Actions deep links: https://docs.world.org/mini-apps/sharing/quick-actions
