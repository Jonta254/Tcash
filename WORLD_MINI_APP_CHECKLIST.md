# Tcash release and World App review

Use the name **Tcash** consistently in the Developer Portal, screenshots, and description. Suggested description:

> Buy and sell WLD or USDC with M-Pesa in Kenya. See fees before paying and track each order through operator-reviewed settlement.

## Implemented in this update

- Paper-and-copper design, light theme by default, readable amounts, mobile tabs, and reduced-motion support.
- Plain sign-in explanation, explicit age/terms/data consent, accessible legal and support links.
- Wallet-connected labels replace username-derived “World verified” badges.
- Server-calculated quotes and saved settlement routing before payment instructions.
- Private Redis storage for orders and World ID records; public Blob fallback removed.
- Ownership validation against the stored record, immutable trade details, closed-state protection, and atomic Redis validation of payment reference reuse.
- Server acknowledgment before success UI; command-result recovery and saved-order continuation.
- Itemized fees, acknowledgment distinct from settlement, and remote history refresh.
- High-value orders fail closed when World ID verification is unavailable.
- Deprecated local signup route redirects to World App sign-in.
- Legal HTML and static files excluded from SPA rewrite; wildcard API CORS removed.

## Must be confirmed before production promotion

- Private Redis credentials configured for the intended environment; migrate existing records and verify history on a second device.
- Inspect any existing public `tmpesa/orders/` and `tmpesa/worldid/` Blob records. Migrate safely before removing public copies; this update does not purge them.
- World App ID and Developer Portal API key configured; receiver wallet allowlisted.
- Correct World ID RP ID, registered action `high-value-order-check`, and matching RP signer. `/api/health` exposes the configured public signer address for comparison with the Portal. A configured key alone does not prove that World App can generate a proof.
- Operator wallet allowlist, PayBill, account name, support inbox, available liquidity, and actual fulfillment procedures verified.
- Operator confirms applicable Kenyan requirements, service availability, policy ownership, retention period, and refund handling. No compliance certification is claimed by this repository.
- Terms and privacy policy reviewed by the operator; in-app fee disclosures match the actual settlement policy.
- No unresolved previous review feedback. The rejection rationale was not supplied during this update.

## Real-device acceptance

Test on iOS and Android inside World App:

1. Wallet Auth succeeds, cancellation is recoverable, and expired sessions prompt sign-in.
2. Buy quote shows all fees; saved order reopens with the same reference and routing; operator verifies M-Pesa and delivers crypto.
3. Sell opens the correct World Pay approval, stores the transaction reference, and pays to the validated M-Pesa number after operator review.
4. Network loss after payment never launches a second payment when retrying order submission. History shows the actual server state after reopening and on another device.
5. Pending chain status is not represented as a mined payment or a settled order.
6. High-value World ID proof generation, verification, cancellation, rejection, and returning-user verification all work against the registered RP signer and action.
7. Keyboard/assistive activation works for final controls; safe areas, small screens, and text scaling remain readable.
8. Support, privacy, terms, icon, and content card are reachable at the deployed URL.

Record the device, app version, order ID, result, and screenshots for each test. Use a controlled test environment and approved payment amounts; local fixtures are not live payment evidence.

## Submission

Submit the tested, reachable final deployment in the World Developer Portal. Confirm the listing says Tcash, describes manual settlement, uses current screenshots, and includes valid support contact details. Do not claim World endorsement or guaranteed verification.

Official sources:
- [App review requirements](https://docs.world.org/mini-apps/guidelines/policy)
- [App and branding guidelines](https://docs.world.org/mini-apps/guidelines/app-guidelines)
- [Mini App testing](https://docs.world.org/mini-apps/quick-start/testing)
- [Wallet Auth](https://docs.world.org/mini-apps/commands/wallet-auth)
- [Pay](https://docs.world.org/mini-apps/commands/pay)

Approval and live World ID proof generation remain unverified until the corresponding Portal and real-device checks succeed.
