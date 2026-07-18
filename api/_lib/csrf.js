// Defense-in-depth against CSRF. The SIWE/admin session cookies use
// SameSite=None (required because World App's WebView context needs
// it), which on its own does not stop a cross-site request from
// carrying the cookie. This checks the Origin (falling back to
// Referer) against the request's own host — a same-origin request
// from the real TCash frontend always matches; a form or script on
// another site making a cross-site POST will not.
//
// Deliberately permissive when the header is *absent* rather than
// rejecting: some mobile WebViews omit Origin on requests this project
// has not been able to verify on a real device inside World App, and
// failing closed on a missing header (rather than a mismatched one)
// risks breaking legitimate traffic this test suite can't reproduce.
// That gap is real and is called out in the production-readiness
// report, not hidden.
export function isTrustedOrigin(req) {
  const origin = req.headers.origin || req.headers.referer;

  if (!origin) {
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    return originHost === req.headers.host;
  } catch {
    return false;
  }
}
