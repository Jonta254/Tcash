import { useEffect, useState } from "react";
import { checkAdminSession } from "../services/backendService";

/**
 * The one place the client asks "am I really an administrator" — and
 * the only correct answer is whatever api/admin-session.js's server
 * check says, never a value read from localStorage. Every screen that
 * shows or gates admin functionality (Profile's admin-desk link,
 * AdminPage itself) uses this same hook so they can never disagree.
 *
 * `status` starts "checking" so callers can render nothing (not a
 * flash of denied-state, not a flash of the console) until the server
 * has actually answered — a user should never see "Access denied" for
 * a heartbeat before it flips to granted, nor the reverse.
 */
export function useAdminSession() {
  const [status, setStatus] = useState("checking"); // "checking" | "granted" | "denied"

  useEffect(() => {
    let active = true;

    checkAdminSession()
      .then((result) => {
        if (active) {
          setStatus(result?.isAdmin ? "granted" : "denied");
        }
      })
      .catch(() => {
        // Fails closed: any error (network, timeout, non-200) is treated
        // as "not an admin," never as "assume yes."
        if (active) {
          setStatus("denied");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
