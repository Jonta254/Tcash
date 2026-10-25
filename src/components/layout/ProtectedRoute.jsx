import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../../services";
import { checkWalletSession } from "../../services/backendService";
import { removeStorage } from "../../services/localStorage";
import { STORAGE_KEYS } from "../../config/appConfig";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const user = getCurrentUser();
  const wallet = user?.walletAddress || "";
  const [state, setState] = useState("checking");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!wallet) { setState("expired"); return; }
    let active = true;
    setState("checking");
    checkWalletSession().then(session => {
      if (!active) return;
      if (session.valid && session.walletAddress?.toLowerCase() === wallet.toLowerCase()) setState("ready");
      else { removeStorage(STORAGE_KEYS.currentUser); setState("expired"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [wallet, attempt]);

  if (!user || state === "expired") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (state === "checking") return <div className="panel stack" role="status">Reconnecting your secure session…</div>;
  if (state === "error") return <section className="panel stack"><h1>Could not reconnect</h1><p>Your saved orders are still on the server. Check your connection and try again.</p><button className="button" onClick={() => setAttempt(value => value + 1)}>Retry connection</button></section>;

  return children;
}

export default ProtectedRoute;
