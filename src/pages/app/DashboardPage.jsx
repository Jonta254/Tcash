import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  APP_CONFIG,
  buildWorldAppDeeplink,
  getCurrentUser,
  getOrdersForCurrentUser,
  getWorldNotificationPermissionState,
  getWorldAppContext,
  getWorldWalletPortfolio,
  getRatingSummary,
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
  const [walletPortfolio, setWalletPortfolio] = useState({ assets: [] });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const worldApp = getWorldAppContext();
  const exchangeRates = useExchangeRates();
  const settings = useAppSettings();
  const orders = getOrdersForCurrentUser();
  const ratingSummary = useMemo(() => getRatingSummary(), []);
  const worldAppLink = buildWorldAppDeeplink("/");
  const launchSource = formatLaunchSource(worldApp.location);
  const hasWorldSession = user?.authMethod === "world-app" || Boolean(user?.username);
  const needsFirstAccessVerification =
    user?.authMethod === "world-app" && !user?.isAdmin && !isUserAccessVerified(user);

  const dashboardStats = useMemo(() => {
    const pending = orders.filter((order) => order.status === "pending").length;
    const paid = orders.filter((order) => order.status === "paid").length;
    const completed = orders.filter((order) => order.status === "completed").length;
    const totalVolumeKes = orders.reduce((sum, order) => sum + Number(order.kesAmount || 0), 0);
    const completionRate = orders.length ? Math.round((completed / orders.length) * 100) : 0;

    return {
      pending,
      paid,
      completed,
      totalVolumeKes,
      completionRate,
    };
  }, [orders]);

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
    if (!user?.walletAddress) {
      return;
    }

    let active = true;
    setWalletLoading(true);
    setWalletError("");

    getWorldWalletPortfolio(user.walletAddress)
      .then((portfolio) => {
        if (active) {
          setWalletPortfolio(portfolio);
        }
      })
      .catch((error) => {
        if (active) {
          setWalletError(error instanceof Error ? error.message : "Unable to load your World wallet.");
        }
      })
      .finally(() => {
        if (active) {
          setWalletLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.walletAddress]);

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
      navigate(nextPath && nextPath !== "/" ? nextPath : "/", { replace: true });
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
        <section className="panel stack verification-surface">
          <div className="verification-surface-head">
            <span className="brand-kicker">First access</span>
            <span className="live-badge">Human check required</span>
          </div>
          <div>
            <h3>Unlock trading inside TMpesa</h3>
            <p className="muted">
              Your World sign-in is complete. Finish one human verification to unlock buy and sell
              actions, then TMpesa will remember your verified access for future sessions.
            </p>
          </div>
          {location.state?.requiresVerification ? (
            <div className="notice">
              TMpesa brought you here first because verification is still required before trading.
            </div>
          ) : null}
          {verificationError ? <div className="error">{verificationError}</div> : null}
          <button
            type="button"
            className="button"
            onClick={handleFirstAccessVerification}
            disabled={verificationLoading}
          >
            {verificationLoading ? "Opening World verification..." : "Complete World Verification"}
          </button>
        </section>
      ) : null}

      {!user?.isAdmin && !user?.mpesaPhoneNumber ? (
        <section className="panel stack">
          <span className="brand-kicker">Payout setup</span>
          <div>
            <h3>Add your M-Pesa payout number</h3>
            <p className="muted">
              TMpesa uses this number for cash settlement whenever you sell WLD or USDC from your
              World account.
            </p>
          </div>
          {profileError ? <div className="error">{profileError}</div> : null}
          {profileMessage ? <div className="notice">{profileMessage}</div> : null}
          <div className="field">
            <label htmlFor="profileMpesaPhone">M-Pesa phone number</label>
            <input
              id="profileMpesaPhone"
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
              placeholder="0712345678"
            />
          </div>
          <button type="button" className="button" onClick={handleProfileSave}>
            Save payout number
          </button>
        </section>
      ) : null}

      <section className="hero-card hero-card-featured dashboard-hero">
        <div className="hero-grid">
          <div className="stack">
            <div className="hero-topline">
              <span className="brand-kicker">{hasWorldSession ? "World account active" : "TMpesa launch"}</span>
              <span className="live-badge">Kenya settlement desk</span>
            </div>
            <div className="dashboard-hero-copy">
              <h2 className="brand-title">Buy and sell WLD or USDC with a premium M-Pesa flow.</h2>
              <p className="brand-copy">
                Welcome {user?.username ? `@${user.username}` : user?.fullName}. TMpesa is built
                for trusted Kenya settlement, manual review, strong support access, and expansion
                into a full crypto cash desk over time.
              </p>
            </div>

            <div className="story-exchange-card">
              <div className="story-node story-node-kes">
                <span>From</span>
                <strong>M-Pesa</strong>
                <small>KES cash rail</small>
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

            <div className="quick-action-grid">
              <Link to="/sell" className="quick-action-card quick-action-card-sell">
                <strong>Sell for KES</strong>
                <span>Send crypto from World App and settle to your saved M-Pesa number.</span>
              </Link>
              <Link to="/buy" className="quick-action-card quick-action-card-buy">
                <strong>Buy from M-Pesa</strong>
                <span>Place an order, pay the till number, then receive crypto after review.</span>
              </Link>
              <Link to="/orders" className="quick-action-card quick-action-card-orders">
                <strong>Track orders</strong>
                <span>See pending, paid, and completed status in one clean activity view.</span>
              </Link>
            </div>
          </div>

          <div className="summary-card stack elevated-summary-card">
            <h3>Account snapshot</h3>
            <div className="stats-grid">
              <div className="mini-stat">
                Pending
                <strong>{dashboardStats.pending}</strong>
              </div>
              <div className="mini-stat">
                Completed
                <strong>{dashboardStats.completed}</strong>
              </div>
              <div className="mini-stat">
                Volume
                <strong>KES {dashboardStats.totalVolumeKes.toLocaleString()}</strong>
              </div>
              <div className="mini-stat">
                Completion
                <strong>{dashboardStats.completionRate}%</strong>
              </div>
            </div>
            <div className="dashboard-balance-card">
              <span>Current market board</span>
              <div className="dashboard-balance-values">
                <div>
                  <strong>KES {exchangeRates.WLD}</strong>
                  <small>per 1 WLD</small>
                </div>
                <div>
                  <strong>KES {exchangeRates.USDC}</strong>
                  <small>per 1 USDC</small>
                </div>
              </div>
            </div>
            <div className="info-grid">
              <div className="info-box">
                <strong>Launch source</strong>
                <code>{launchSource}</code>
              </div>
              <div className="info-box">
                <strong>Payout phone</strong>
                <code>{user?.mpesaPhoneNumber || "Not added yet"}</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="market-board-grid">
        <article className="market-panel">
          <div className="split">
            <span className="tag">Rate board</span>
            <span className="market-panel-note">Manual desk pricing</span>
          </div>
          <div className="market-token-list">
            <div className="market-token-card">
              <span>Worldcoin</span>
              <strong>WLD</strong>
              <small>KES {exchangeRates.WLD}</small>
            </div>
            <div className="market-token-card">
              <span>Digital dollars</span>
              <strong>USDC</strong>
              <small>KES {exchangeRates.USDC}</small>
            </div>
          </div>
        </article>

        <article className="market-panel market-panel-soft">
          <div className="split">
            <span className="tag">Desk method</span>
            <span className="market-panel-note">Built to expand</span>
          </div>
          <div className="market-feature-list">
            <div>
              <strong>Manual confirmation</strong>
              <span>Every order is reviewed before final settlement or delivery.</span>
            </div>
            <div>
              <strong>World-linked identity</strong>
              <span>Usernames and wallet addresses remain attached to each trade flow.</span>
            </div>
            <div>
              <strong>Support-first operations</strong>
              <span>Email and WhatsApp paths stay close to every order and payout step.</span>
            </div>
          </div>
        </article>
      </section>

      {user?.walletAddress ? (
        <section className="panel stack">
          <div className="split">
            <div>
              <span className="brand-kicker">Wallet at home</span>
              <h3>Your live World wallet snapshot</h3>
              <p className="muted">
                TMpesa reads WLD and USDC using your World wallet address so you can decide how
                much to sell before opening the trade flow.
              </p>
            </div>
            <span className="live-badge">WLD + USDC</span>
          </div>
          {walletError ? <div className="error">{walletError}</div> : null}
          {walletLoading ? <div className="notice">Loading wallet balances...</div> : null}
          {!walletLoading ? (
            <div className="wallet-asset-grid">
              {walletPortfolio.assets.map((asset) => (
                <div key={asset.symbol} className="wallet-asset-card">
                  <span>{asset.name}</span>
                  <strong>{asset.formattedBalance}</strong>
                  <small>{asset.symbol}</small>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {!hasWorldSession && !worldApp.isInstalled && worldAppLink ? (
        <section className="panel stack">
          <span className="brand-kicker">Open in World App</span>
          <p className="muted">
            For Wallet Auth, World verification, and in-app crypto payment, open TMpesa inside
            World App.
          </p>
          <a href={worldAppLink} className="button-secondary">
            Open in World App
          </a>
        </section>
      ) : null}

      <section className="feature-story-grid">
        <article className="feature-story-card">
          <span className="feature-story-icon">KES</span>
          <div>
            <strong>Settlement to M-Pesa</strong>
            <p>Your saved payout number is used when sell orders complete and KES is released.</p>
          </div>
        </article>
        <article className="feature-story-card">
          <span className="feature-story-icon">ID</span>
          <div>
            <strong>World identity attached</strong>
            <p>TMpesa remembers your World username and secure wallet identity across sessions.</p>
          </div>
        </article>
        <article className="feature-story-card">
          <span className="feature-story-icon">PM</span>
          <div>
            <strong>Room to grow</strong>
            <p>The app shell is ready for referrals, analytics, compliance, wallet insights, and live operations.</p>
          </div>
        </article>
        <article className="feature-story-card">
          <span className="feature-story-icon">★</span>
          <div>
            <strong>Community rating pulse</strong>
            <p>{ratingSummary.totalRatings ? `${ratingSummary.averageRating}/5 from ${ratingSummary.totalRatings} ratings.` : "Be one of the first users to rate TMpesa."}</p>
          </div>
        </article>
      </section>

      <section className="panel stack growth-center-panel">
        <div className="split">
          <div>
            <span className="brand-kicker">Growth and trust center</span>
            <h3>Referral tools, analytics, compliance, and live wallet insight</h3>
            <p className="muted">
              TMpesa now includes a dedicated account layer for wallet visibility, referral growth,
              notification controls, and trading intelligence built around World mini app patterns.
            </p>
          </div>
          <Link to="/profile" className="button-secondary growth-center-link">
            Open Profile Hub
          </Link>
        </div>
        <div className="growth-center-grid">
          <div className="growth-center-card">
            <strong>Referrals</strong>
            <span>Share the mini app through native World sharing and World Chat invite flows.</span>
          </div>
          <div className="growth-center-card">
            <strong>Analytics</strong>
            <span>Track trades, completion rate, first trade date, and account progress in one place.</span>
          </div>
          <div className="growth-center-card">
            <strong>Compliance</strong>
            <span>Review Wallet Auth state, first-access verification, username status, and permissions.</span>
          </div>
          <div className="growth-center-card">
            <strong>Live wallet</strong>
            <span>See WLD and USDC balances from your World wallet address using World Chain reads.</span>
          </div>
        </div>
        <div className="button-row compact-actions">
          <Link to="/profile" className="button-secondary">
            Manage referrals and wallet
          </Link>
          <Link to="/profile" className="button-ghost">
            Rate TMpesa
          </Link>
        </div>
      </section>

      <section className="support-footer">
        <div>
          <strong>Support and delay follow-up</strong>
          <p>Use email for account questions, or open WhatsApp if a payment or payout needs fast attention.</p>
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
                Stay updated on order placement, review, and completion without leaving the World
                mini app flow.
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
