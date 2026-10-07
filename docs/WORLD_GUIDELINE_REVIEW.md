# World guideline review and production gate

Reviewed 7 October 2026 against the current official pages below. This document records an independent code and product review; World retains approval discretion. A deployment is not evidence of native integration or legal compliance.

| Requirement | Current evidence | Release action |
| --- | --- | --- |
| Plain naming, distinct brand, no World endorsement | Tcash name, hand-authored square nonwhite icon and paper/copper interface; no official badge | Operator confirms name rights and Portal listing accuracy |
| Clear description under 25 words | Buy and sell WLD or USDC with M-Pesa in Kenya. See fees before paying and track operator-reviewed settlement. | Use consistently in Portal |
| Complete mobile app | Home, Wallet, Trade, History, Profile, Support, Guidelines and operator screens reviewed; 320/390px fixture checks | Record iOS/Android native screens and keyboard/safe-area tests |
| Consent and data minimization | Explicit age/terms/data consent; relevant wallet, payout, order and optional notification data; World ID records disclosed | Operator approves identity, privacy ownership and retention |
| Meaningful live SDK integration | MiniKit Wallet Auth/Pay and high-value World ID implemented; server session and proof gates | Native success/cancellation/recovery evidence required |
| Payment finality | Backend Portal check; submitted evidence differs from settled; manual operator receipt checks required | Controlled real buy/sell payout and reconciliation required |
| Functional relevant notifications | Signed session, stored-order ownership, bounded provider requests, server-written state copy and fixed recipient/path | Native opt-in and delivery test; no marketing notifications |
| Poor-network handling | Request timeouts, durable saved quotes, reference recovery, retry states and history refresh | Native interrupted-payment and second-device tests required |
| Usernames for identity | Username used for account identity; addresses shown only for receiving/payment instructions and detailed records | Verify actual World usernames resolve |
| Listing artwork | 512px square icon; 1035×720 text-free PNG card with lower clear/blur region; marketing art is not screenshots | Genuine screenshots from World App required |
| Accessible review URL/support | Public production access inspected separately from protected preview; support email shown | Confirm inbox ownership and final URL reachability |
| Jurisdictional compliance | Kenya scope, 18+ and manual fulfillment disclosures | Operator compliance confirmation required; code cannot establish it |
| Previous rejection remediated | Rejection rationale not provided | Match fixes to actual feedback before resubmission |
| Private records | Private Redis used for new records | Audit/migrate/remove any legacy public Blob copies with operator approval |

## Production release sequence

1. Commit and push reviewed code; verify the exact preview SHA and deployment.
2. Record native and operational evidence above against that candidate. Do not label fixtures as payments.
3. Confirm production app ID, Portal receiver allowlist, RP signer/action, private storage and operator settings. Health flags are configuration checks only.
4. Build in the production environment, verify the candidate, then release the intended production domain. Retain the previous production deployment as rollback reference.
5. Verify public landing/legal/support/assets, API authentication, quote freshness and native commands at the canonical production origin.
6. Submit accurate Portal information and screenshots. Do not claim approval until World reports it.

Native test evidence, operational/legal confirmation and previous rejection feedback remain pending. Production promotion must not be represented as complete until it happens and is verified.

## Official sources

- [App review requirements](https://docs.world.org/mini-apps/guidelines/policy)
- [App guidelines](https://docs.world.org/mini-apps/guidelines/app-guidelines)
- [Design guidelines](https://docs.world.org/mini-apps/guidelines/design-guidelines)
- [Notification guidelines](https://docs.world.org/mini-apps/guidelines/features-and-guidelines)
- [Wallet Auth](https://docs.world.org/mini-apps/commands/wallet-auth)
- [Pay](https://docs.world.org/mini-apps/commands/pay)

Validation for this candidate: 146 tests across 23 files, undefined-runtime-name check and production Vite build pass. World-native commands and real funds were not exercised by the agent.
