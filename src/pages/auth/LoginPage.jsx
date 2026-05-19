import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  buildWorldAppDeeplink,
  connectWithWorldAppWallet,
  evaluateReferralRewards,
  findUserByUsername,
  findUserByWalletAddress,
  findReferrerByCode,
  getCurrentUser,
  getWorldAppContext,
  getWorldNotificationPermissionState,
  isUserAccessVerified,
  loginUser,
  loginWithWorldApp,
  notifyAdminReferralEvent,
  requestWorldNotificationPermission,
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
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationPromptLoading, setNotificationPromptLoading] = useState(false);
  const [notificationPromptError, setNotificationPromptError] = useState("");
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

  useEffect(() => {
    let active = true;

    const checkNotifications = async () => {
      if (!worldApp.isInstalled) {
        return;
      }

      const permissionState = await getWorldNotificationPermissionState();

      if (active && !permissionState.granted) {
        setShowNotificationPrompt(true);
      }
    };

    checkNotifications();

    return () => {
      active = false;
    };
  }, [worldApp.isInstalled]);

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
      const nextUser = loginWithWorldApp(profile, {
        firstAccessVerified: existingUser?.firstAccessVerified || isAlreadyHumanVerified,
        firstAccessVerifiedAt:
          existingUser?.firstAccessVerifiedAt ||
          (isAlreadyHumanVerified ? new Date().toISOString() : null),
        firstAccessVerificationLevel:
          existingUser?.firstAccessVerificationLevel || (isAlreadyHumanVerified ? "address-book" : ""),
        referredByCode: existingUser?.referredByCode || (!existingUser && referralCode ? referralCode : ""),
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
          referredUsername: nextUser.username || "",
          referredLabel: nextUser.fullName || nextUser.phone || "New user",
          referredWalletAddress: nextUser.walletAddress || "",
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

  const handleEnableNotifications = async () => {
    setNotificationPromptError("");
    setNotificationPromptLoading(true);

    try {
      const permissionState = await requestWorldNotificationPermission();

      if (!permissionState.granted) {
        throw new Error("World notification permission was not granted.");
      }

      setShowNotificationPrompt(false);
    } catch (err) {
      setNotificationPromptError(
        err instanceof Error ? err.message : "TMpesa could not enable notifications.",
      );
    } finally {
      setNotificationPromptLoading(false);
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
                Buy and sell WLD or USDC with M-Pesa using World wallet sign-in and clean manual
                settlement.
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
                <p>Approve Wallet Auth inside the official World sheet.</p>
              </div>
              <div className={authStage === "unlock" ? "active" : ""}>
                <strong>2. Open TMpesa</strong>
                <p>TMpesa attaches your World username and wallet to the account.</p>
              </div>
              <div>
                <strong>3. Unlock trading</strong>
                <p>New users complete one human check only when needed.</p>
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
              identity needed to recognize your account and settle orders safely.
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
                <strong>Kenya cash settlement</strong>
                <p>M-Pesa payout, till payment, and practical trade support.</p>
              </div>
            </div>
            <div>
              <span className="auth-feature-icon auth-feature-blue">WLD</span>
              <div>
                <strong>Built for World users</strong>
                <p>Wallet Auth and World notifications fit the mini app flow.</p>
              </div>
            </div>
            <div>
              <span className="auth-feature-icon auth-feature-gold">PRO</span>
              <div>
                <strong>Ready to expand</strong>
                <p>Structured for referrals, analytics, automation, and live ops.</p>
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

        {showNotificationPrompt ? (
          <div className="notification-prompt-overlay" role="dialog" aria-modal="true">
            <div className="notification-prompt-card">
              <button
                type="button"
                className="notification-prompt-close"
                onClick={() => setShowNotificationPrompt(false)}
                aria-label="Close notification prompt"
              >
                ×
              </button>
              <div className="notification-prompt-icon" aria-hidden="true">✦</div>
              <div className="stack">
                <span className="brand-kicker">World notifications</span>
                <h3>Enable TMpesa alerts</h3>
                <p className="muted">
                  Turn on notifications to receive a World alert when your order is placed,
                  reviewed, or completed.
                </p>
              </div>
              {notificationPromptError ? <div className="error">{notificationPromptError}</div> : null}
              <div className="button-row compact-actions">
                <button
                  type="button"
                  className="button"
                  onClick={handleEnableNotifications}
                  disabled={notificationPromptLoading}
                >
                  {notificationPromptLoading ? "Opening World permission..." : "Enable notifications"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setShowNotificationPrompt(false)}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default LoginPage;
