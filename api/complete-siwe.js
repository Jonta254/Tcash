import { verifySiweMessage } from "@worldcoin/minikit-js";
import { parseCookies, serializeCookie } from "./_lib/cookies.js";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { logEvent, logSecurityEvent } from "./_lib/log.js";
import {
  createUserSessionToken,
  USER_SESSION_COOKIE,
  USER_SESSION_MAX_AGE,
} from "./_lib/userSession.js";
import { isValidSignedServerNonce } from "./_lib/world.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const { payload, nonce, nonceSignature } = await readJsonBody(req);
    const cookies = parseCookies(req);

    if (!payload?.signature || !payload?.message) {
      sendJson(res, 400, {
        isValid: false,
        error: "World wallet authentication was not completed.",
      });
      return;
    }

    const cookieMatches = nonce && nonce === cookies.tmpesa_siwe;
    const signedNonceMatches = isValidSignedServerNonce(nonce, nonceSignature);

    if (!cookieMatches && !signedNonceMatches) {
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
