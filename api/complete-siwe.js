import { verifySiweMessage } from "@worldcoin/minikit-js";
import { serializeCookie } from "./_lib/cookies.js";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { logEvent, logSecurityEvent } from "./_lib/log.js";
import {
  createUserSessionToken,
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE,
} from "./_lib/userSession.js";
import { claimSiweNonce, isValidSignedServerNonce } from "./_lib/world.js";
import { isTrustedOrigin } from "./_lib/csrf.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST", "DELETE"])) {
    return;
  }
  if (req.method === "DELETE") {
    if (!isTrustedOrigin(req)) {
      sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
      return;
    }
    res.setHeader("Set-Cookie", [USER_SESSION_COOKIE, "tmpesa_siwe", "tmpesa_payment_reference"].map(name =>
      serializeCookie(name, "", { maxAge: 0, sameSite: "None", secure: true }),
    ));
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    const { payload, nonce, nonceSignature } = await readJsonBody(req);

    if (!payload?.signature || !payload?.message) {
      sendJson(res, 400, {
        isValid: false,
        error: "World wallet authentication was not completed.",
      });
      return;
    }

    const signedNonceMatches = isValidSignedServerNonce(nonce, nonceSignature);

    if (!signedNonceMatches) {
      logSecurityEvent("siwe.nonce_mismatch", {});
      sendJson(res, 400, {
        isValid: false,
        error: "World wallet session expired. Please try again.",
      });
      return;
    }

    const verification = await verifySiweMessage(payload, nonce);
    const verifiedAddress = verification.siweMessageData?.address || payload.address;
    const isValid = Boolean(verification.isValid && verifiedAddress);

    const clearSiweNonceCookie = serializeCookie("tmpesa_siwe", "", {
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    });

    if (!isValid) {
      logSecurityEvent("siwe.verification_failed", {});
      res.setHeader("Set-Cookie", clearSiweNonceCookie);
      sendJson(res, 200, { isValid: false, address: verifiedAddress, nonce });
      return;
    }

    // This is the one place a real, server-verified identity comes into
    // existence for a regular user — every other endpoint that needs to
    // know "who is this" reads the signed cookie set here, never a
    // client-supplied walletAddress/userId field.
    if (!(await claimSiweNonce(nonce))) {
      sendJson(res, 400, { isValid: false, error: "This sign-in request was already used. Start sign-in again." });
      return;
    }
    const sessionToken = createUserSessionToken(verifiedAddress);
    const setUserSessionCookie = serializeCookie(USER_SESSION_COOKIE, sessionToken, {
      maxAge: USER_SESSION_MAX_AGE,
      sameSite: "None",
      secure: true,
    });

    res.setHeader("Set-Cookie", [clearSiweNonceCookie, setUserSessionCookie]);
    logEvent("siwe.verified", { walletAddress: verifiedAddress });

    sendJson(res, 200, {
      isValid: true,
      address: verifiedAddress,
      nonce,
    });
  } catch (error) {
    sendJson(res, 400, {
      isValid: false,
      error: error instanceof Error ? error.message : "Unable to verify wallet auth.",
    });
  }
}
