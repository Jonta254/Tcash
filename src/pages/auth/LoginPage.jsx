import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  buildWorldAppDeeplink,
  connectWithWorldAppWallet,
  evaluateReferralRewards,
  findReferrerByCode,
  findUserByUsername,
  findUserByWalletAddress,
  getCurrentUser,
  getWorldAppContext,
  loginWithWorldApp,
  notifyAdminReferralEvent,
  tenderHaptics,
} from "../../services";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const settings = useAppSettings();
  const worldApp = getWorldAppContext();
  const [error, setError] = useState("");
  const [worldLoading, setWorldLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authStage, setAuthStage] = useState("idle");
  const targetPath = location.state?.from?.pathname || "/";
  const referralCode = (searchParams.get("ref") || "").trim().toUpperCase();

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
    setError("");
    setWorldLoading(true);
    setAuthStage("wallet");
    setAuthStatus("Connecting your World wallet...");

    try {
      const profile = await connectWithWorldAppWallet();
      const existingUser =
        findUserByWalletAddress(profile.walletAddress) || findUserByUsername(profile.username);

      setAuthStage("unlock");
      setAuthStatus("Opening your Tcash session...");

      loginWithWorldApp(profile, {
        referredByCode:
          existingUser?.referredByCode || (!existingUser && referralCode ? referralCode : ""),
      });

      if (!existingUser && referralCode) {
        const referrer = findReferrerByCode(referralCode);
        const rewardState = referrer ? evaluateReferralRewards(referrer) : null;

        notifyAdminReferralEvent({
          eventType: "signup",
          referralCode,
          referrerUsername: referrer?.username || "",
          referrerLabel: referrer?.fullName || referrer?.phone || "Tcash referrer",
          referrerMpesaPhoneNumber: referrer?.mpesaPhoneNumber || "",
          referredUsername: profile.username || "",
          referredLabel: profile.fullName || profile.username || "New user",
          referredWalletAddress: profile.walletAddress || "",
          referredUsers: rewardState?.summary.referredUsers || 0,
          activatedUsers: rewardState?.summary.activatedUsers || 0,
          eligibleRewardKes: rewardState?.eligibleRewardKes || 0,
          createdAt: new Date().toISOString(),
        });
      }

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
    <div className="page-bg">
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
          The bridge between your World wallet and M-Pesa. One tap, a human review, your money.
        </p>

        {error ? <p className="tdr-login-error">{error}</p> : null}
        {authStatus ? <p className="tdr-login-status">{authStatus}</p> : null}

        <div className="tdr-login-actions">
          <button
            type="button"
            className="tdr-login-cta"
            onClick={handleWorldAppLogin}
            disabled={!worldApp.isInstalled || worldLoading}
          >
            {worldLoading ? "Opening World approval…" : "Continue with World App"}
          </button>

          {worldApp.isInstalled ? (
            <span className="tdr-login-hint">Tcash opens your wallet session automatically.</span>
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
      </div>
    </div>
  );
}

export default LoginPage;
