import { useEffect, useState } from "react";

/*
 * There was no offline detection anywhere in this app before this hook —
 * a user who lost signal mid-trade saw only whatever generic "could not
 * reach the secure server" message the failed fetch happened to produce,
 * indistinguishable from a real server error. This gives every screen a
 * single, honest source of truth for "are we actually connected" so the
 * app can say that plainly instead of guessing from a fetch failure.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
