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
