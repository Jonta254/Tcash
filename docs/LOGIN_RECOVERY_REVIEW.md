# Login recovery review — 25 October 2026

The review feedback says only "app not working". The failing reviewer step has not been identified. A successful deployment and public health response do not demonstrate native MiniKit success.

User follow-up: sign-in remains loading after wallet approval. MiniKit 1.9.6's async wallet-auth handler awaits its username HTTP request before resolving the approval response. The application timeout added in the first pass only bounds that failure; it does not remove the blocking lookup.

The subsequent fix migrates to MiniKit 2.0.3 top-level async commands and `{ executedWith, data }` results. Its native wallet-auth command resolves approval without fetching a username. Backend SIWE uses the new `/siwe` export; payments and haptics use the new command API too. The application's optional profile lookup remains bounded. World App versions too old for wallet-auth v2 now receive the SDK's explicit update error rather than an unresolved command.

## Confirmed integration defects and fixes

- Installed MiniKit 1.9.6's provider reads `props.appId`, whereas Tcash supplied a top-level `appId`. Updated the wrapper to match the installed SDK contract and added a regression test.
- Native wallet-auth commands and optional username lookup previously had no application timeout. Sign-in now exits after 90 seconds without a native response; optional post-verification lookup falls back after five seconds.
- Local profiles previously opened protected screens without checking whether the signed server session still existed. The existing complete-siwe function now supports a non-cacheable GET session check. Protected routes reconnect, redirect expired/mismatched profiles to sign-in, and provide a retry screen on connection failure.
- New sign-ins verify that the browser retained the signed session cookie before opening the app. Backend authentication failures record a non-sensitive failure stage without logging signatures or nonce credentials.

## Evidence and limits

173 tests across 29 files passed; runtime name checks and production build passed. Browser fixtures verified expired-session redirect, network-error UI and successful retry. Fixtures are not native authentication evidence.

Migration validation: 174 tests across 30 files passed using Vitest 4.1.12; full dependency audit reports zero known vulnerabilities. A test using the real MiniKit 2 SDK and simulated bridge verifies approval resolves without invoking a deliberately never-resolving username fetch. Browser testing uses the real SDK with a simulated native bridge and mocked backend; it is not a real wallet signature or payment.

The production home, nonce, health and price endpoints responded successfully during investigation. Health values indicate configuration, not a confirmed payment or database write. Aggregated runtime errors were empty; historical request logs were unavailable beyond the plan's retention. A recent 30-minute log query had no matching entries. This does not prove the reviewer encountered no error.

An unfunded, ephemeral EOA signature probe was correctly rejected by the SDK's smart-wallet EIP-1271 verification path. It does not establish successful World App authentication. No customer session, order or financial transfer was changed.

Before resubmission, test a real World App wallet on a device against the exact release: fresh sign-in, cancellation/retry, persisted session, buy/sell quote, payment flow/recovery and history. Record the precise step and error for any failure. Verify required external domains and receiver permissions in the Portal. Do not claim this generic rejection fully resolved until native evidence is available.
