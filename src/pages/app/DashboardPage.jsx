import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import StatusPill from "../../components/orders/StatusPill";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  APP_CONFIG,
  getCurrentUser,
  getOrdersForCurrentUser,
  getReferralSummary,
  getWorldWalletPortfolio,
  isUserAccessVerified,
  markReferralShared,
  openWorldChatInvite,
  openSupportEmail,
  openWhatsAppSupport,
  requestWorldVerification,
  shareMiniAppInvite,
  updateCurrentUserProfile,
  waitForWorldHumanVerification,
} from "../../services";

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
  const [walletPortfolio, setWalletPortfolio] = useState({ assets: [] });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const [referralRefreshKey, setReferralRefreshKey] = useState(0);
  const exchangeRates = useExchangeRates();
  const orders = getOrdersForCurrentUser();
  const recentOrders = orders.slice(0, 3);
  const referralSummary = useMemo(() => getReferralSummary(user), [user, referralRefreshKey]);
  const needsFirstAccessVerification =
    user?.authMethod === "world-app" && !user?.isAdmin && !isUserAccessVerified(user);

  const walletBoard = useMemo(() => {
    const assets = walletPortfolio.assets.map((assetEntry) => {
      const marketRate = exchangeRates[assetEntry.symbol] || 0;
      const balance = Number(assetEntry.formattedBalance || 0);
      const kesValue = Math.round(balance * marketRate * 100) / 100;

      return {
        ...assetEntry,
        marketRate,
        kesValue,
      };
    });

    const findAsset = (symbol) => assets.find((entry) => entry.symbol === symbol);

    return {
      assets,
      totalKes: assets.reduce((sum, assetEntry) => sum + Number(assetEntry.kesValue || 0), 0),
      wld: findAsset("WLD"),
      usdc: findAsset("USDC"),
    };
  }, [exchangeRates, walletPortfolio.assets]);

  useEffect(() => {
    if (!user?.walletAddress) {
      setWalletPortfolio({ assets: [] });
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
  }, [user?.walletAddress, walletRefreshKey]);

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
        const nextUser = updateCurrentUserProfile({
          firstAccessVerified: true,
          firstAccessVerifiedAt: new Date().toISOString(),
          firstAccessVerificationLevel: "address-book",
        });
        setUser(nextUser);
      }
    };

    syncVerificationState();

    return () => {
      active = false;
    };
  }, [needsFirstAccessVerification, user?.walletAddress]);

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

  const handleFirstAccessVerification = async () => {
    if (!user?.walletAddress) {
      setVerificationError("TMpesa needs your World wallet session before verification can start.");
      return;
    }

    setVerificationError("");
    setVerificationLoading(true);

    try {
      const verification = await requestWorldVerification({
        action: APP_CONFIG.firstAccessVerificationAction,
        signal: `first-access:${user.walletAddress.toLowerCase()}`,
        verificationLevel: "device",
      });
      const nextUser = updateCurrentUserProfile({
        firstAccessVerified: true,
        firstAccessVerifiedAt: new Date().toISOString(),
        firstAccessVerificationLevel: verification.verificationLevel,
      });
      setUser(nextUser);

      const nextPath = location.state?.from?.pathname;
      navigate(nextPath && nextPath !== "/" ? nextPath : "/", { replace: true });
    } catch (error) {
      setVerificationError(
        error instanceof Error ? error.message : "TMpesa could not complete your first-access verification.",
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleShareReferral = async () => {
    try {
      await shareMiniAppInvite({
        title: "Join TMpesa",
        text: `Join me on TMpesa with my invite code ${referralSummary.code}.`,
        url: referralSummary.appLink,
      });
      markReferralShared(user);
      setReferralRefreshKey((value) => value + 1);
    } catch {}
  };

  const handleShareReferralToWorldChat = async () => {
    try {
      await openWorldChatInvite({
        message: `Join TMpesa with my invite code ${referralSummary.code}. ${referralSummary.appLink}`,
      });
      markReferralShared(user);
      setReferralRefreshKey((value) => value + 1);
    } catch {}
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
            <h3>Unlock trading</h3>
            <p className="muted">
              Your World sign-in is complete. Finish one human verification before placing buy or
              sell orders.
            </p>
          </div>
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
              TMpesa uses this number whenever a sell order is reviewed and released in KES. You
              can change it anytime from Profile.
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
          <Link to="/profile" className="text-link">Manage payout settings</Link>
        </section>
      ) : null}

      <section className="panel home-header-panel">
        <span className="brand-kicker">World settlement wallet</span>
        <div className="split compact-top-row">
          <div>
            <h2>{user?.username ? `@${user.username}` : "TMpesa wallet"}</h2>
            <p className="muted">
              {user?.walletAddress ? "World wallet connected" : "Connect your World wallet to start trading."}
            </p>
          </div>
          <span className={`status-pill ${isUserAccessVerified(user) ? "completed" : "pending"}`}>
            {isUserAccessVerified(user) ? "Verified" : "Pending"}
          </span>
        </div>
      </section>

      <section className="panel stack home-balance-panel">
        <div className="split">
          <div>
            <span className="brand-kicker">Wallet balance</span>
            <h3>Estimated total balance</h3>
          </div>
          <button
            type="button"
            className="button-ghost"
            onClick={() => setWalletRefreshKey((value) => value + 1)}
          >
            {user?.walletAddress ? "Refresh balance" : "Connect wallet"}
          </button>
        </div>
        {walletError ? <div className="error">{walletError}</div> : null}
        {walletLoading ? <div className="notice">Refreshing wallet balances...</div> : null}
        <div className="home-balance-hero">
          <span>Total Balance</span>
          <strong>KES {walletBoard.totalKes.toLocaleString()}</strong>
          <small>Live read from your World wallet session</small>
        </div>
        <div className="wallet-asset-grid">
          <div className="wallet-asset-card">
            <span>Worldcoin</span>
            <strong>{walletBoard.wld?.formattedBalance || "0"}</strong>
            <small>WLD</small>
          </div>
          <div className="wallet-asset-card">
            <span>Digital Dollars</span>
            <strong>{walletBoard.usdc?.formattedBalance || "0"}</strong>
            <small>USDC</small>
          </div>
          <div className="wallet-asset-card">
            <span>KES equivalent</span>
            <strong>KES {walletBoard.totalKes.toLocaleString()}</strong>
            <small>Manual desk preview</small>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Quick actions</span>
            <h3>Start an action quickly</h3>
          </div>
        </div>
        <div className="quick-action-grid home-quick-actions">
          <Link to="/trade?tab=buy" className="quick-action-card quick-action-card-buy">
            <strong>Buy</strong>
            <span>Pay with M-Pesa.</span>
          </Link>
          <Link to="/trade?tab=sell" className="quick-action-card quick-action-card-sell">
            <strong>Sell</strong>
            <span>Receive KES to M-Pesa.</span>
          </Link>
          <Link to="/wallet#receive" className="quick-action-card quick-action-card-orders">
            <strong>Receive</strong>
            <span>Copy your receive address.</span>
          </Link>
          <Link to="/orders" className="quick-action-card quick-action-card-orders">
            <strong>Orders</strong>
            <span>Track your latest activity.</span>
          </Link>
        </div>
      </section>

      <section className="market-board-grid">
        <article className="market-panel">
          <div className="split">
            <span className="brand-kicker">Rates preview</span>
            <span className="market-panel-note">Manual desk pricing</span>
          </div>
          <div className="market-token-list">
            <div className="market-token-card">
              <span>WLD</span>
              <strong>KES {exchangeRates.WLD}</strong>
              <small>per 1 WLD</small>
            </div>
            <div className="market-token-card">
              <span>USDC</span>
              <strong>KES {exchangeRates.USDC}</strong>
              <small>per 1 USDC</small>
            </div>
          </div>
        </article>
      </section>

      {!user?.isAdmin ? (
        <section className="panel stack compact-referral-card">
          <div className="split">
            <div>
              <span className="brand-kicker">Referral</span>
              <h3>Invite and earn</h3>
              <p className="muted">
                Share your link. Reach 6 activated users for KES 100 and 10 for KES 150.
              </p>
            </div>
            <span className="status-pill paid">{referralSummary.code}</span>
          </div>
          <div className="profile-summary-grid">
            <div className="profile-summary-card">
              <span>Referred</span>
              <strong>{referralSummary.referredUsers}</strong>
            </div>
            <div className="profile-summary-card">
              <span>Activated</span>
              <strong>{referralSummary.activatedUsers}</strong>
            </div>
            <div className="profile-summary-card">
              <span>Claimable</span>
              <strong>
                {referralSummary.pendingMilestones.length
                  ? referralSummary.pendingMilestones.map((milestone) => `KES ${milestone.rewardKes}`).join(", ")
                  : "None"}
              </strong>
            </div>
          </div>
          <div className="button-row compact-actions">
            <button type="button" className="button-secondary" onClick={handleShareReferral}>
              Share Invite
            </button>
            <button type="button" className="button-ghost" onClick={handleShareReferralToWorldChat}>
              World Chat
            </button>
          </div>
          <div className="soft-note">
            {referralSummary.pendingMilestones.length
              ? `Reward unlocked. Open Profile to claim ${referralSummary.pendingMilestones
                  .map((milestone) => `KES ${milestone.rewardKes}`)
                  .join(" and ")} to your saved M-Pesa number.`
              : "Keep sharing your TMpesa invite. Rewards unlock after referred users complete trades."}
          </div>
        </section>
      ) : null}

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Recent orders</span>
            <h3>Latest activity</h3>
          </div>
          <Link to="/orders" className="button-secondary">
            View all orders
          </Link>
        </div>
        {recentOrders.length ? (
          <div className="recent-order-list">
            {recentOrders.map((order) => (
              <article key={order.id} className="recent-order-card">
                <div className="split">
                  <div>
                    <span className="tag">{order.type}</span>
                    <strong>{order.cryptoAmount} {order.asset}</strong>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <div className="recent-order-meta">
                  <span>KES {order.kesAmount.toLocaleString()}</span>
                  <span>{order.destinationUsername ? `@${order.destinationUsername}` : order.payoutPhoneNumber || "TMpesa order"}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="notice">No orders yet. Start with Buy or Sell from the quick actions above.</div>
        )}
      </section>

      <section className="support-footer support-footer-emphasis">
        <div>
          <strong>Need help with a payment delay?</strong>
          <p>Email support or open WhatsApp for urgent payout follow-up.</p>
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
        <Link to="/support" className="text-link">Open support center</Link>
      </section>
    </div>
  );
}

export default DashboardPage;
