import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  APP_CONFIG,
  buildWorldAppDeeplink,
  getCurrentUser,
  getOrdersForCurrentUser,
  getWorldNotificationPermissionState,
  getWorldAppContext,
  isUserAccessVerified,
  openSupportEmail,
  openWhatsAppSupport,
  requestWorldNotificationPermission,
  requestWorldVerification,
  updateCurrentUserProfile,
  waitForWorldHumanVerification,
} from "../../services";
import { useExchangeRates } from "../../hooks/useExchangeRate";

function formatLaunchSource(location) {
  if (!location) {
    return "Browser";
  }

  if (typeof location === "string") {
    return location;
  }

  if (typeof location === "object") {
    return location.open_origin || location.source || "World App";
  }

  return "World App";
}

function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialUser = getCurrentUser();
  const [user, setUser] = useState(initialUser);
  const [profilePhone, setProfilePhone] = useState(initialUser?.mpesaPhoneNumber || initialUser?.phone || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const worldApp = getWorldAppContext();
  const exchangeRates = useExchangeRates();
  const settings = useAppSettings();
  const orders = getOrdersForCurrentUser();
  const worldAppLink = buildWorldAppDeeplink("/");
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const paidOrders = orders.filter((order) => order.status === "paid").length;
  const completedOrders = orders.filter((order) => order.status === "completed").length;
  const launchSource = formatLaunchSource(worldApp.location);
  const hasWorldSession = user?.authMethod === "world-app" || Boolean(user?.username);
  const needsFirstAccessVerification =
    user?.authMethod === "world-app" && !user?.isAdmin && !isUserAccessVerified(user);

  const completeLocalVerification = (verificationLevel = "address-book") => {
    const nextUser = updateCurrentUserProfile({
      firstAccessVerified: true,
      firstAccessVerifiedAt: new Date().toISOString(),
      firstAccessVerificationLevel: verificationLevel,
    });

    setUser(nextUser);
    return nextUser;
  };

  useEffect(() => {
    let active = true;

    const syncNotificationPermission = async () => {
      const permissionState = await getWorldNotificationPermissionState();

      if (active) {
        setNotificationsEnabled(permissionState.granted);
      }
    };

    syncNotificationPermission();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!needsFirstAccessVerification || !user?.walletAddress) {
      return;
    }

    let active = true;

    const syncVerificationState = async () => {
      const isVerified = await waitForWorldHumanVerification(user.walletAddress, {
        attempts: 2,
        intervalMs: 700,
      });

      if (active && isVerified) {
        completeLocalVerification("address-book");
      }
    };

    syncVerificationState();

    const handleVisibilityOrFocus = () => {
      syncVerificationState();
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [needsFirstAccessVerification, user?.walletAddress]);

  const handleFirstAccessVerification = async () => {
    if (!user?.walletAddress) {
      setVerificationError("TMpesa needs your World wallet session before verification can start.");
      return;
    }

    setVerificationError("");
    setVerificationLoading(true);

    try {
      const isAlreadyHumanVerified = await waitForWorldHumanVerification(user.walletAddress, {
        attempts: 2,
        intervalMs: 700,
      });

      if (isAlreadyHumanVerified) {
        completeLocalVerification("address-book");

        const nextPath = location.state?.from?.pathname;
        navigate(nextPath && nextPath !== "/" ? nextPath : "/", { replace: true });
        return;
      }

      const verification = await requestWorldVerification({
        action: APP_CONFIG.firstAccessVerificationAction,
        signal: `first-access:${user.walletAddress.toLowerCase()}`,
        verificationLevel: "device",
      });

      completeLocalVerification(verification.verificationLevel);

      const nextPath = location.state?.from?.pathname;
      if (nextPath && nextPath !== "/") {
        navigate(nextPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (error) {
      const isVerifiedAfterReturn = await waitForWorldHumanVerification(user.walletAddress, {
        attempts: 8,
        intervalMs: 1500,
      });

      if (isVerifiedAfterReturn) {
        completeLocalVerification("address-book");

        const nextPath = location.state?.from?.pathname;
        navigate(nextPath && nextPath !== "/" ? nextPath : "/", { replace: true });
        return;
      }

      setVerificationError(
        error instanceof Error ? error.message : "TMpesa could not complete your first-access verification.",
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleProfileSave = () => {
    setProfileError("");
    setProfileMessage("");

    if (!profilePhone.trim()) {
      setProfileError("Enter the M-Pesa phone number you want payouts sent to.");
      return;
    }

    const nextUser = updateCurrentUserProfile({ mpesaPhoneNumber: profilePhone.trim() });
    setUser(nextUser);
    setProfileMessage("Payout phone saved. Sell orders will use this number.");
  };

  const handleEnableNotifications = async () => {
    setNotificationError("");
    setNotificationLoading(true);

    try {
      const permissionState = await requestWorldNotificationPermission();

      if (!permissionState.granted) {
        throw new Error("World notification permission was not granted.");
      }

      setNotificationsEnabled(true);
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : "TMpesa could not enable World notifications.",
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  return (
    <div className="stack">
      {needsFirstAccessVerification ? (
        <section className="panel stack">
          <span className="brand-kicker">First access</span>
          <div>
            <h3>Complete your World verification</h3>
            <p className="muted">
              Your Wallet Auth sign-in is active. Before you place your first TMpesa order, complete
              one World human check to unlock sell and buy actions.
            </p>
          </div>
          {location.state?.requiresVerification ? (
            <div className="notice">
              TMpesa brought you here first because first-access verification is still required.
            </div>
          ) : null}
          {verificationError ? <div className="error">{verificationError}</div> : null}
          <button
            type="button"
            className="button"
            onClick={handleFirstAccessVerification}
            disabled={verificationLoading}
          >
            {verificationLoading ? "Opening World verification..." : "Complete First-Access Verification"}
          </button>
        </section>
      ) : null}

      {!user?.isAdmin && !user?.mpesaPhoneNumber ? (
        <section className="panel stack">
          <span className="brand-kicker">Payout Setup</span>
          <div>
            <h3>Add your M-Pesa payout number</h3>
            <p className="muted">
              TMpesa saves this number for sell orders. When you sell WLD or USDC, the admin uses
              it to send your KES payout after confirming your World payment.
            </p>
          </div>
          {profileError ? <div className="error">{profileError}</div> : null}
          {profileMessage ? <div className="notice">{profileMessage}</div> : null}
          <div className="field">
            <label htmlFor="profileMpesaPhone">M-Pesa Phone Number</label>
            <input
              id="profileMpesaPhone"
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
              placeholder="0712345678"
            />
          </div>
          <button type="button" className="button" onClick={handleProfileSave}>
            Save Payout Number
          </button>
        </section>
      ) : null}

      <section className="hero-card">
        <div className="hero-grid">
          <div className="stack">
            <span className="brand-kicker">{hasWorldSession ? "World account active" : "Inside World App"}</span>
            <div>
              <h2 className="brand-title">{APP_CONFIG.appName} exchange desk.</h2>
              <p className="brand-copy">
                Welcome {user?.fullName}. Start by keeping your M-Pesa payout number updated, then
                choose whether you want to sell crypto for KES or buy crypto with M-Pesa.
              </p>
            </div>
            <div className="amount-line">
              <span>Current rates</span>
              <strong>WLD: KES {exchangeRates.WLD} | USDC: KES {exchangeRates.USDC}</strong>
            </div>
            <div className="info-grid">
              <div className="info-box">
                <strong>Sell receiver wallet</strong>
                <code>{settings.sellWalletAddress}</code>
              </div>
              <div className="info-box">
                <strong>Your payout number</strong>
                <code>{user?.mpesaPhoneNumber || "Not added yet"}</code>
              </div>
            </div>
            {!hasWorldSession && !worldApp.isInstalled && worldAppLink ? (
              <a href={worldAppLink} className="button-secondary">
                Open in World App
              </a>
            ) : null}
          </div>

          <div className="summary-card stack">
            <h3>Quick Summary</h3>
            <div className="stats-grid">
              <div className="mini-stat">
                Pending
                <strong>{pendingOrders}</strong>
              </div>
              <div className="mini-stat">
                Paid
                <strong>{paidOrders}</strong>
              </div>
              <div className="mini-stat">
                Completed
                <strong>{completedOrders}</strong>
              </div>
              <div className="mini-stat">
                Launch
                <strong>{launchSource}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="gold-guide-card">
        <div className="gold-guide-head">
          <span className="gold-guide-badge">User guide</span>
          <span className="gold-guide-accent">Smooth steps</span>
        </div>
        <h3>Your TMpesa flow in brief</h3>
        <div className="gold-guide-list">
          <div>
            <strong>1. Keep your payout number ready</strong>
            <p>
              Add the M-Pesa number you want to receive KES on. TMpesa keeps it attached to your
              account for sell orders.
            </p>
          </div>
          <div>
            <strong>2. Sell from your World account</strong>
            <p>
              Enter the amount, confirm the order, then send WLD or USDC. Your World username stays
              linked to the order for review.
            </p>
          </div>
          <div>
            <strong>3. Buy with M-Pesa when needed</strong>
            <p>
              Enter the amount you want to buy, pay the shown till number, then mark the order as
              paid so the admin can complete delivery.
            </p>
          </div>
          <div>
            <strong>4. Track everything in Orders</strong>
            <p>
              Watch your status move from pending to paid to completed, and contact support if a
              settlement takes longer than expected.
            </p>
          </div>
        </div>
      </section>

      <section className="action-grid">
        <article className="action-card stack">
          <span className="tag">Sell WLD/USDC</span>
          <h3>Send crypto, receive KES</h3>
          <p className="muted">
            World Pay sends your asset to TMpesa. Admin then pays KES to your saved M-Pesa number.
          </p>
          {needsFirstAccessVerification ? (
            <button type="button" className="button" onClick={handleFirstAccessVerification} disabled={verificationLoading}>
              Unlock Sell Flow
            </button>
          ) : (
            <Link to="/sell" className="button">
              Sell Crypto
            </Link>
          )}
        </article>

        <article className="action-card stack">
          <span className="tag">Buy WLD/USDC</span>
          <h3>Pay M-Pesa, receive crypto</h3>
          <p className="muted">
            TMpesa records your World username or wallet, then shows the till and amount to pay.
          </p>
          {needsFirstAccessVerification ? (
            <button type="button" className="button" onClick={handleFirstAccessVerification} disabled={verificationLoading}>
              Unlock Buy Flow
            </button>
          ) : (
            <Link to="/buy" className="button">
              Buy Crypto
            </Link>
          )}
        </article>
      </section>

      <section className="support-footer">
        <div>
          <strong>Support</strong>
          <p>Email support for account help, or open WhatsApp quickly if your order payout is delayed.</p>
        </div>
        <div className="button-row compact-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              openSupportEmail({
                subject: "TMpesa support request",
                body: [
                  "Hello TMpesa support,",
                  "",
                  "I need help with my account or order.",
                  "",
                  `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
                ].join("\n"),
              })
            }
          >
            Email Support
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() =>
              openWhatsAppSupport({
                message: [
                  "Hello TMpesa support,",
                  "",
                  "My payment or settlement is delayed and I need assistance.",
                  "",
                  `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
                ].join("\n"),
              })
            }
          >
            Payment Delay
          </button>
        </div>
      </section>

      {hasWorldSession ? (
        <section className="panel stack">
          <span className="brand-kicker">World alerts</span>
          <div className="split">
            <div>
              <h3>Enable order notifications in World App</h3>
              <p className="muted">
                TMpesa can request World notification permission so users can receive order updates
                inside World App after placement.
              </p>
            </div>
            <span className={`status-pill ${notificationsEnabled ? "completed" : "pending"}`}>
              {notificationsEnabled ? "Enabled" : "Not enabled"}
            </span>
          </div>
          {notificationError ? <div className="error">{notificationError}</div> : null}
          {!notificationsEnabled ? (
            <button
              type="button"
              className="button"
              onClick={handleEnableNotifications}
              disabled={notificationLoading}
            >
              {notificationLoading ? "Opening World permission..." : "Enable World Notifications"}
            </button>
          ) : (
            <div className="notice">
              World notification permission is already enabled for this TMpesa session.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default DashboardPage;
