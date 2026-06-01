import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  connectWithWorldAppWallet,
  evaluateReferralRewards,
  findReferrerByCode,
  findUserByUsername,
  findUserByWalletAddress,
  getCurrentUser,
  getWorldAppContext,
  isUserAccessVerified,
  loginWithWorldApp,
  notifyAdminReferralEvent,
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

    return !isUserAccessVerified(user) ? "/" : targetPath;
  };

  const finalizeSessionRedirect = () => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      throw new Error("TMpesa could not save your login session. Please try again.");
    }

    if (!currentUser.isAdmin && !isUserAccessVerified(currentUser)) {
      navigate("/", {
        replace: true,
        state: {
          requiresVerification: true,
          from: location.state?.from || { pathname: targetPath },
        },
      });
      return;
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
      setAuthStatus("Opening your TMpesa session...");

      loginWithWorldApp(profile, {
        firstAccessVerified: existingUser?.firstAccessVerified || false,
        firstAccessVerifiedAt: existingUser?.firstAccessVerifiedAt || null,
        firstAccessVerificationLevel: existingUser?.firstAccessVerificationLevel || "",
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
          referrerLabel: referrer?.fullName || referrer?.phone || "TMpesa referrer",
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

      finalizeSessionRedirect();
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthStage("idle");
      setAuthStatus("");
      setWorldLoading(false);
    }
  };

  return (
    <div className="page-bg">
      <div className="auth-layout auth-layout-single">
        <section className="auth-card stack auth-entry-card auth-splash-card">
          <div className="auth-splash-top">
            <div className="auth-logo-frame">
              <img src="/tmpesa-icon.svg" alt="TMpesa" className="auth-logo-mark" />
            </div>
            <div className="auth-splash-copy">
              <div className="auth-title-row">
                <span className="brand-kicker">World mini app</span>
                <span className="live-badge">Wallet Auth</span>
              </div>
              <h2>TMpesa</h2>
              <p className="muted">Buy and sell WLD or USDC with M-Pesa inside World App.</p>
            </div>
          </div>

          {error ? <div className="error">{error}</div> : null}
          {location.state?.requiresVerification ? (
            <div className="notice">
              Your World session is connected, but TMpesa still needs your first-access World check
              before trading opens.
            </div>
          ) : null}
          {authStatus ? <div className="notice">{authStatus}</div> : null}

          <div className="auth-gate-card">
            <div className="auth-gate-head">
              <span className="secure-access-badge">World sign in</span>
              <span className="secure-access-trust">Fast entry</span>
            </div>

            <div className="auth-gate-copy">
              <div>
                <span className="tag">Wallet Auth</span>
                <h3>Enter TMpesa through World App</h3>
              </div>
              <p className="muted">Approve once, open your wallet session, and start trading.</p>
            </div>

            <div className="auth-mini-flow" aria-label="Wallet login flow">
              <div className={authStage === "wallet" ? "active" : ""}>
                <span>1</span>
                <strong>Approve wallet</strong>
              </div>
              <div className={authStage === "unlock" ? "active" : ""}>
                <span>2</span>
                <strong>Open session</strong>
              </div>
              <div>
                <span>3</span>
                <strong>Start trading</strong>
              </div>
            </div>
          </div>

          <div className="stack auth-cta-block">
            <button
              type="button"
              className="button auth-connect-button"
              onClick={handleWorldAppLogin}
              disabled={!worldApp.isInstalled || worldLoading}
            >
              {worldLoading ? "Opening World approval..." : "Continue with World App"}
            </button>
            <div className="notice auth-inline-note">
              {worldApp.isInstalled
                ? "World App detected. TMpesa will open your wallet session and continue inside the app."
                : "Open TMpesa inside World App to continue with wallet authentication."}
            </div>
            {!worldApp.isInstalled && settings.worldAppId ? (
              <div className="soft-note">
                Use the World App mini app link to continue with Wallet Auth.
              </div>
            ) : null}
          </div>

          <div className="auth-compact-benefits">
            <div className="auth-benefit-chip">
              <span className="auth-feature-icon auth-feature-green">KES</span>
              <strong>Cash settlement</strong>
            </div>
            <div className="auth-benefit-chip">
              <span className="auth-feature-icon auth-feature-blue">WLD</span>
              <strong>World-native desk</strong>
            </div>
            <div className="auth-benefit-chip">
              <span className="auth-feature-icon auth-feature-gold">PRO</span>
              <strong>Operator reviewed</strong>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default LoginPage;
