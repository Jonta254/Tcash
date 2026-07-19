/**
 * Structured logging for financial/security events.
 *
 * This is deliberately not a call to a logging *service* — there's no
 * Sentry/Datadog/etc. credential available to wire up from here, and
 * fabricating one would be worse than not having it. What this does
 * is real: Vercel captures every serverless function's stdout/stderr
 * into its own Logs product (queryable in the dashboard, exportable
 * via a log drain to a real provider later) — so a consistent JSON
 * shape on every financial event is a genuine, if minimal,
 * observability foundation, not a placeholder.
 *
 * Every call includes `event` (a stable machine-readable name) and
 * enough identifiers to trace one transaction across log lines
 * (orderId, reference) without ever logging a secret (passwords,
 * session tokens, full API keys never appear in the fields passed
 * here — callers are responsible for that; this module doesn't try
 * to redact after the fact because a scrubber can't tell a secret
 * from a legitimate M-Pesa code, wallet address, etc).
 */
export function logEvent(event, fields = {}) {
  const line = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

export function logSecurityEvent(event, fields = {}) {
  const line = {
    ts: new Date().toISOString(),
    event,
    security: true,
    ...fields,
  };

  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(line));
}

/**
 * The audit trail for privileged administrator actions specifically —
 * distinct from logEvent/logSecurityEvent because an audit record has a
 * fixed, required shape (who, when, what, on what, with what outcome),
 * not a free-form fields bag. Every privileged write must call this
 * exactly once with its real outcome; there is no "silent" administrative
 * action in this codebase — if a privileged branch doesn't produce one of
 * these lines, that's a bug in the endpoint, not a missing feature here.
 *
 * `administrator` is the admin's own wallet address (from
 * api/_lib/adminAuth.js's getRequestAdminWallet, never a client-supplied
 * value), `requestId` ties every audit line for one HTTP request
 * together even when it touches multiple targets (e.g. a batch order
 * sync), and `result` is always one of "success" | "denied" | "failed"
 * so these lines can be filtered/alerted on without parsing free text.
 */
export function logAdminAction({ requestId, administrator, action, target, result, ...fields }) {
  const line = {
    ts: new Date().toISOString(),
    event: "admin.action",
    audit: true,
    requestId,
    administrator,
    action,
    target,
    result,
    ...fields,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
