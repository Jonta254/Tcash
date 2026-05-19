import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  buildWorldAppDeeplink,
  connectWithWorldAppWallet,
  findUserByUsername,
  findUserByWalletAddress,
  getCurrentUser,
  getWorldAppContext,
  isUserAccessVerified,
  loginUser,
  loginWithWorldApp,
  waitForWorldHumanVerification,
} from "../../services";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const settings = useAppSettings();
  const worldApp = getWorldAppContext();
  const worldAppLink = buildWorldAppDeeplink(location.state?.from?.pathname || "/");
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [worldLoading, setWorldLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authStage, setAuthStage] = useState("idle");
  const targetPath = location.state?.from?.pathname || "/";
  const referralCode = (searchParams.get("ref") || "").trim().toUpperCase();

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

    navigate(targetPath, { replace: true });

    window.setTimeout(() => {
      const latestUser = getCurrentUser();

      if (latestUser && window.location.pathname === "/login") {
        window.location.replace(
          !latestUser.isAdmin && !isUserAccessVerified(latestUser) ? "/" : targetPath,
        );
      }
    }, 120);
  };

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (currentUser) {
      navigate(
        !currentUser.isAdmin && !isUserAccessVerified(currentUser) ? "/" : targetPath,
        { replace: true },
      );
    }
  }, [navigate, targetPath]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    try {
      loginUser(form);
      finalizeSessionRedirect();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWorldAppLogin = async () => {
    setError("");
    setWorldLoading(true);
    setAuthStage("wallet");
    setAuthStatus("Connecting your World wallet...");

    try {
      const profile = await connectWithWorldAppWallet();
      const existingUser =
        findUserByWalletAddress(profile.walletAddress) || findUserByUsername(profile.username);
      const needsFirstAccessVerification = !isUserAccessVerified(existingUser);
      const isAlreadyHumanVerified = needsFirstAccessVerification
        ? await waitForWorldHumanVerification(profile.walletAddress, {
            attempts: 3,
            intervalMs: 900,
          })
        : false;

      setAuthStage("unlock");
      setAuthStatus(
        needsFirstAccessVerification && !isAlreadyHumanVerified
          ? "Opening TMpesa and preparing your first-access verification..."
          : "Opening your TMpesa session...",
      );
      loginWithWorldApp(profile, {
        firstAccessVerified: existingUser?.firstAccessVerified || isAlreadyHumanVerified,
        firstAccessVerifiedAt:
          existingUser?.firstAccessVerifiedAt ||
          (isAlreadyHumanVerified ? new Date().toISOString() : null),
        firstAccessVerificationLevel:
          existingUser?.firstAccessVerificationLevel || (isAlreadyHumanVerified ? "address-book" : ""),
        referredByCode: existingUser?.referredByCode || (!existingUser && referralCode ? referralCode : ""),
      });

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
                <span className="brand-kicker">Kenya to World</span>
                <span className="live-badge">Premium access</span>
              </div>
              <h2>TMpesa</h2>
              <p className="muted">
                A high-trust M-Pesa settlement desk for World users. Move from Kenya cash rails to
                WLD and USDC with secure World login, guided steps, and clean manual review.
              </p>
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

          <div className="story-exchange-card auth-story-card">
            <div className="story-node story-node-kes">
              <span>From</span>
              <strong>M-Pesa</strong>
              <small>KES settlement</small>
            </div>
            <div className="story-connector" aria-hidden="true">
              <span />
            </div>
            <div className="story-node story-node-world">
              <span>To</span>
              <strong>World assets</strong>
              <small>WLD and USDC</small>
            </div>
          </div>

          <div className="secure-access-card">
            <div className="secure-access-head">
              <span className="secure-access-badge">Secure access</span>
              <span className="secure-access-trust">Wallet Auth first</span>
            </div>
            <h3>Login with World Wallet Auth</h3>
            <p className="muted">
              TMpesa follows the World mini app flow: wallet sign-in first, one-time human
              verification only when needed, then direct entry into the trading desk.
            </p>
            <div className="secure-step-list">
              <div className={authStage === "wallet" ? "active" : ""}>
                <strong>1. Connect wallet</strong>
                <p>Confirm your World wallet and username inside the World approval sheet.</p>
              </div>
              <div className={authStage === "unlock" ? "active" : ""}>
                <strong>2. Open TMpesa</strong>
                <p>TMpesa opens immediately and attaches your World identity to the account.</p>
              </div>
              <div>
                <strong>3. Unlock trading</strong>
                <p>New users complete one human check inside the app before using protected flows.</p>
              </div>
            </div>
          </div>

          <div className="launch-card stack">
            <div className="launch-card-head">
              <div>
                <span className="tag">World-native sign in</span>
                <h3>Enter the exchange desk</h3>
              </div>
              <span className="secure-access-trust">Approval in World App</span>
            </div>
            <p className="muted">
              Tap continue to open the official World approval surface. TMpesa requests only the
              identity needed to recognize your account and settle your orders safely.
            </p>
            <div className="launch-permissions">
              <div>
                <strong>World username</strong>
                <span>Used to identify your TMpesa account and route crypto delivery.</span>
              </div>
              <div>
                <strong>Wallet address</strong>
                <span>Used for secure login, World Pay, and verification state checks.</span>
              </div>
              <div>
                <strong>Human verification state</strong>
                <span>Used only to unlock protected trading steps when needed.</span>
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
            <div className="notice">
              {worldApp.isInstalled
                ? "World App detected. TMpesa will sign you in first, then ask new users for one-time verification inside the app."
                : "Open TMpesa inside World App to continue with wallet authentication."}
            </div>
            {!worldApp.isInstalled && settings.worldAppId ? (
              <a href={worldAppLink} className="button-secondary">
                Open in World App
              </a>
            ) : null}
          </div>

          <div className="auth-feature-list">
            <div>
              <span className="auth-feature-icon auth-feature-green">KES</span>
              <div>
                <strong>Made for Kenya cash settlement</strong>
                <p>Designed around M-Pesa payout, till payment, and practical trade support.</p>
              </div>
            </div>
            <div>
              <span className="auth-feature-icon auth-feature-blue">WLD</span>
              <div>
                <strong>Built for World users</strong>
                <p>Wallet Auth, World verification, and in-app notifications fit the mini app flow.</p>
              </div>
            </div>
            <div>
              <span className="auth-feature-icon auth-feature-gold">PRO</span>
              <div>
                <strong>Ready to expand</strong>
                <p>TMpesa is structured for future referrals, analytics, automation, and live ops.</p>
              </div>
            </div>
          </div>

          <details className="admin-access-panel">
            <summary>Admin access</summary>
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="phone">Admin phone number</label>
                <input
                  id="phone"
                  name="phone"
                  placeholder="0700000000"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="password">Admin password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter admin password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <button type="submit" className="button-secondary">
                Open Admin
              </button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}

export default LoginPage;
