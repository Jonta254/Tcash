# Admin order review

Updated 20 October 2026.

- Only a server-recognized operator can mark an order completed or rejected.
- Pending orders can move to review after entering an incoming M-Pesa code for buys or World Chain transaction hash for manual sells. An existing incoming reference remains immutable.
- Reviewed sell orders require the outgoing 10-character M-Pesa payout code to mark done. Reviewed buys require the outgoing crypto delivery transaction hash. Incoming and outgoing references are separate.
- Rejection requires a customer-visible reason of 5–500 characters. Rejection does not refund funds.
- Server stamps reviewer wallet and review time. Customer history displays settlement reference or rejection reason. The UI waits for a confirmed server response before updating its local record.
- Failed writes pause actions until the queue refreshes. Duplicate clicks are blocked. Atomic storage checks reject reused settlement references and conflicting concurrent status updates. Closed records cannot reopen or change review evidence.

Code-format checks do not establish actual M-Pesa or blockchain receipt. The operator must independently check asset, amount, recipient and actual settlement before confirming. Mark done does not transfer funds.

Validation: 164 tests across 26 files passed; runtime check and production build passed. API persistence tests use a mocked Redis transport, not a live Redis instance. Browser fixture tests cover malformed references, rejection reason, settlement code, terminal actions disappearing and customer History. No real customer order, payout or notification was changed during testing.
