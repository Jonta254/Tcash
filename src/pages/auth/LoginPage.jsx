import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  buildWorldAppDeeplink,
  connectWithWorldAppWallet,
  getCurrentUser,
  getWorldAppContext,
  loginWithWorldApp,
  tenderHaptics,
} from "../../services";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useAppSettings();
  const worldApp = getWorldAppContext();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [worldLoading, setWorldLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authStage, setAuthStage] = useState("idle");
  const targetPath = location.state?.from?.pathname || "/";

  const getPostLoginPath = (user) => {
    if (!user) {
      return targetPath;
    }

    if (user.isAdmin) {
      const requestedPath = location.state?.from?.pathname;
      return requestedPath === "/admin" || requestedPath === "/tmpesa-admin" ? requestedPath : "/";
    }

    return targetPath;
  };

  const finalizeSessionRedirect = () => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      throw new Error("Tcash could not save your login session. Please try again.");
    }

    const nextPath = getPostLoginPath(currentUser);

    navigate(nextPath, { replace: true });

    window.setTimeout(() => {
      const latestUser = getCurrentUser();

      if (latestUser && window.location.pathname === "/login") {
        window.location.replace(getPostLoginPath(latestUser));
      }
    }, 120);
  };

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (currentUser) {
      navigate(getPostLoginPath(currentUser), { replace: true });
    }
  }, [navigate, targetPath]);

  const handleWorldAppLogin = async () => {
    if (!consent || worldLoading) return;
    setError("");
    setWorldLoading(true);
    setAuthStage("wallet");
    setAuthStatus("Connecting your World wallet...");

    try {
      const profile = await connectWithWorldAppWallet();

      setAuthStage("unlock");
      setAuthStatus("Opening your Tcash session...");

      loginWithWorldApp(profile);

      tenderHaptics.verify();
      finalizeSessionRedirect();
    } catch (err) {
      tenderHaptics.warn();
      setError(err.message);
    } finally {
      setAuthStage("idle");
      setAuthStatus("");
      setWorldLoading(false);
    }
  };

  return (
    <div className="page-bg tcash-auth-page">
      <div className="tdr-login page-enter">
        <span className="tdr-login-kicker">World mini app</span>

        <div className="tdr-login-mark" aria-hidden="true">
          <span className="tdr-bridge-word">WLD</span>
          <span className="tdr-bridge-line">
            <span className="tdr-bridge-dot" />
          </span>
          <span className="tdr-bridge-word">KES</span>
        </div>

        <h1 className="tdr-login-word">Tcash</h1>
        <p className="tdr-login-copy">
          Buy WLD or USDC with M-Pesa. Sell to receive Kenyan shillings. Every payment is reviewed by an operator.
        </p>

        {error ? <p className="tdr-login-error" role="alert">{error}</p> : null}
        {authStatus ? <p className="tdr-login-status" role="status">{authStatus}</p> : null}

        <div className="tcash-entry-details" aria-label="How Tcash works">
          <div><span>01</span><p>See the amount and fee before paying.</p></div>
          <div><span>02</span><p>Approve crypto payments in World App.</p></div>
          <div><span>03</span><p>Follow your order through to settlement.</p></div>
        </div>
        <label className="tcash-consent">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>I am 18 or older, accept the <a href="/terms.html" target="_blank" rel="noreferrer">terms</a>, and agree to Tcash storing my wallet details and order information as described in the <a href="/privacy.html" target="_blank" rel="noreferrer">privacy policy</a>.</span>
        </label>
        <div className="tdr-login-actions">
          <button
            type="button"
            className="tdr-login-cta"
            onClick={handleWorldAppLogin}
            disabled={!consent || !worldApp.isInstalled || worldLoading}
          >
            {worldLoading ? "Opening World approval…" : "Continue with World App"}
          </button>

          {worldApp.isInstalled ? (
            <span className="tdr-login-hint">Approve wallet sign-in to continue. Tcash never asks for your PIN or recovery phrase.</span>
          ) : settings.worldAppId ? (
            <a
              className="tdr-login-fallback"
              href={buildWorldAppDeeplink("/login")}
              target="_blank"
              rel="noreferrer"
            >
              Open in World App →
            </a>
          ) : (
            <span className="tdr-login-hint">Wallet Auth only works inside World App.</span>
          )}
        </div>
        <p className="tcash-entry-note">Available for M-Pesa settlement in Kenya. Tcash is independently operated.</p>
        <a className="tdr-login-fallback" href="mailto:brianokindo2022@gmail.com">Contact Tcash support</a>
      </div>
    </div>
  );
}

export default LoginPage;
