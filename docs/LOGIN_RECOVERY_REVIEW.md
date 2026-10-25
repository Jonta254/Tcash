# Login recovery review — 25 October 2026

The review feedback says only "app not working". The failing reviewer step has not been identified. A successful deployment and public health response do not demonstrate native MiniKit success.

## Confirmed integration defects and fixes

- Installed MiniKit 1.9.6's provider reads `props.appId`, whereas Tcash supplied a top-level `appId`. Updated the wrapper to match the installed SDK contract and added a regression test.
- Native wallet-auth commands and optional username lookup previously had no application timeout. Sign-in now exits after 90 seconds without a native response; optional post-verification lookup falls back after five seconds.
- Local profiles previously opened protected screens without checking whether the signed server session still existed. The existing complete-siwe function now supports a non-cacheable GET session check. Protected routes reconnect, redirect expired/mismatched profiles to sign-in, and provide a retry screen on connection failure.
- New sign-ins verify that the browser retained the signed session cookie before opening the app. Backend authentication failures record a non-sensitive failure stage without logging signatures or nonce credentials.

## Evidence and limits

173 tests across 29 files passed; runtime name checks and production build passed. Browser fixtures verified expired-session redirect, network-error UI and successful retry. Fixtures are not native authentication evidence.

The production home, nonce, health and price endpoints responded successfully during investigation. Health values indicate configuration, not a confirmed payment or database write. Aggregated runtime errors were empty; historical request logs were unavailable beyond the plan's retention. A recent 30-minute log query had no matching entries. This does not prove the reviewer encountered no error.

An unfunded, ephemeral EOA signature probe was correctly rejected by the SDK's smart-wallet EIP-1271 verification path. It does not establish successful World App authentication. No customer session, order or financial transfer was changed.

Before resubmission, test a real World App wallet on a device against the exact release: fresh sign-in, cancellation/retry, persisted session, buy/sell quote, payment flow/recovery and history. Record the precise step and error for any failure. Verify required external domains and receiver permissions in the Portal. Do not claim this generic rejection fully resolved until native evidence is available.
