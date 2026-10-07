# Tcash strict review — 7 October 2026

This is an independent implementation review against World mini app guidance, not a review decision from World. **Submission readiness remains conditional** on the real-device and operational checks below.

## Findings fixed

| Finding | Fix |
| --- | --- |
| Username presented as World ID verification | Removed false badges and local reputation scores; identity uses the World App username. |
| Client-reported referral eligibility and reward amounts | New reward claims disabled; historical operator queue retained without changing reward or recipient. |
| Payment command could be lost before durable recovery | Await server storage of the command result before checking chain status; retries reuse the original reference. |
| Unsigned payment preparation/confirmation | Require a signed session and trusted origin; bound transaction identifiers and upstream timeout. |
| Missing manual crypto receiver | Show and copy the receiving address saved with the order, with World Chain guidance. |
| Payment acknowledgment looked like settlement | Receipts say submitted; operator settlement remains separate. |
| Missing rates or balances looked like zero | Unknown values display a dash; stale/failed refresh states are disclosed and quoting fails closed. |
| Promotional claims and distracting interface | Quiet paper/copper ledger, consistent mobile navigation, clear fees, focused Profile and support. |
| Hidden history controls reachable by keyboard | Collapsed order content is inert with disclosure state exposed. |
| Inaccurate legal/payment instructions | Saved quote policy and actual PayBill account instructions; consistent public legal pages. |
| Generic listing imagery and false certification reports | Hand-authored vector brand assets; historical reports marked superseded. |

The earlier pass also added private Redis storage, order ownership checks, immutable quotes/routing, atomic payment-reference uniqueness and server acknowledgment before success UI.

## Evidence

- 130 automated tests across 18 files passed, including signed-session restrictions, disabled client reward claims and payment recovery sequencing.
- Production Vite build passed.
- Browser review at 320 and 390 pixel mobile widths covered Home, Wallet, Buy, Sell, History, Profile, Support, Guidelines and operator access states. Reviewed routes showed no horizontal overflow or crash fallback.
- Local browser trade checks used an isolated fixture harness, not real money or a real World App session. Invalid phone validation, theme switching, saved fee breakdowns and the manual receiver were checked.
- Preview API checks in the preceding pass returned healthy configuration, fresh market rates and 401 for unsigned order access. A new deployment must be checked after this commit.
- Listing card inspected at 1035 × 720. It is vector artwork, not a product screenshot. Capture actual World App screens for screenshot slots.

## Required before submission or production promotion

1. Test Wallet Auth, cancellation, World Pay, interrupted-payment recovery and high-value World ID proof inside World App on iOS and Android. Tests cannot establish native command compatibility.
2. Match the configured RP signer and action with the Developer Portal; confirm receiver allowlisting and application identity. Configured credentials alone are insufficient evidence.
3. Complete one controlled buy and sell through actual operator payout, with payment evidence and correct completed history on a second device. The operator must validate amount, asset, network, receiver and reference before payout.
4. Audit and migrate any historical public Blob order/World ID records before removing public copies. This code does not retroactively privatize them.
5. Confirm legal operator identity, applicable Kenyan requirements, liquidity, support inbox ownership, refund procedure, retention and the published policies.
6. Address the previous rejection rationale, which was not provided. Ensure the submitted production URL is reachable by World reviewers and supply genuine in-app screenshots.

## Review sources

- [World app policy](https://docs.world.org/mini-apps/guidelines/policy)
- [World app design guidance](https://docs.world.org/mini-apps/guidelines/app-guidelines)
- [World Pay](https://docs.world.org/mini-apps/commands/pay)

No official approval, legal certification, completed real settlement or native proof success is claimed.
