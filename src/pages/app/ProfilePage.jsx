import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatWorldLaunchSource,
  getCurrentUser,
  getOrdersForCurrentUser,
  getReferralSummary,
  getRatingSummary,
  getWorldNotificationPermissionState,
  getWorldAppContext,
  markReferralShared,
  openWorldChatInvite,
  openSupportEmail,
  openWhatsAppSupport,
  requestWorldNotificationPermission,
  saveUserRating,
  shareMiniAppInvite,
} from "../../services";

function formatJoinedDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProfilePage() {
  const user = getCurrentUser();
  const orders = getOrdersForCurrentUser();
  const worldApp = getWorldAppContext();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [referralSummary, setReferralSummary] = useState(() => getReferralSummary(user));
  const [referralError, setReferralError] = useState("");
  const [ratingSummary, setRatingSummary] = useState(() => getRatingSummary());
  const [ratingError, setRatingError] = useState("");

  useEffect(() => {
    let active = true;

    const syncNotifications = async () => {
      const state = await getWorldNotificationPermissionState();

      if (active) {
        setNotificationsEnabled(state.granted);
      }
    };

    syncNotifications();

    return () => {
      active = false;
    };
  }, []);

  const profileStats = useMemo(() => {
    const totalTrades = orders.length;
    const fulfilled = orders.filter((order) => order.status === "completed").length;
    const firstTrade = orders[orders.length - 1]?.createdAt || null;
    const completionRate = totalTrades ? Math.round((fulfilled / totalTrades) * 100) : 0;

    return {
      totalTrades,
      fulfilled,
      completionRate,
      firstTrade,
    };
  }, [orders]);

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
        error instanceof Error ? error.message : "TMpesa could not enable notifications.",
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleShareInvite = async () => {
    setReferralError("");

    try {
      const inviteText = `Join me on TMpesa with my invite code ${referralSummary.code}. Buy and sell WLD or USDC with M-Pesa settlement inside World App.`;
      await shareMiniAppInvite({
        title: "Join TMpesa",
        text: inviteText,
        url: referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to share invite.");
    }
  };

  const handleShareToWorldChat = async () => {
    setReferralError("");

    try {
      await openWorldChatInvite({
        message: `Try TMpesa with my invite code ${referralSummary.code}. Use World App to buy or sell WLD and USDC with M-Pesa settlement.`,
      });
      setReferralSummary(markReferralShared(user));
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to open World Chat invite.");
    }
  };

  const handleRateTmPesa = (rating) => {
    setRatingError("");

    try {
      setRatingSummary(saveUserRating(user, rating));
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : "Unable to save your rating.");
    }
  };

  return (
    <div className="stack">
      <section className="panel profile-hero">
        <div className="profile-hero-head">
          <div className="profile-avatar">{(user?.username || user?.fullName || "T").slice(0, 1).toUpperCase()}</div>
          <div>
            <span className="brand-kicker">Account</span>
            <h2>{user?.username ? `@${user.username}` : user?.fullName || "TMpesa user"}</h2>
            <p className="muted">
              Your TMpesa profile keeps payout details, order history, World notification status,
              and trading progress in one place.
            </p>
          </div>
        </div>
        <div className="profile-summary-grid">
          <div className="profile-summary-card">
            <span>Preferred currency</span>
            <strong>{user?.preferredCurrency || "KES"}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Payout number</span>
            <strong>{user?.mpesaPhoneNumber || "Not added"}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Launch source</span>
            <strong>{formatWorldLaunchSource(worldApp.location)}</strong>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Account</span>
            <h3>Wallet and security tools</h3>
            <p className="muted">
              Wallet balances, receive address, live wallet state, and identity details now live on
              the dedicated Wallet page.
            </p>
          </div>
          <Link to="/wallet" className="button-secondary">
            Open Wallet
          </Link>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Referral center</span>
            <h3>Invite new World users to TMpesa</h3>
            <p className="muted">
              Share TMpesa using native World mini app sharing so future referral and rewards flows
              can plug into the same account structure cleanly.
            </p>
          </div>
          <span className="status-pill paid">Code {referralSummary.code}</span>
        </div>
        {referralError ? <div className="error">{referralError}</div> : null}
        <div className="profile-summary-grid">
          <div className="profile-summary-card">
            <span>Invite actions</span>
            <strong>{referralSummary.shareCount}</strong>
          </div>
          <div className="profile-summary-card">
            <span>New users</span>
            <strong>{referralSummary.referredUsers}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Activated traders</span>
            <strong>{referralSummary.activatedUsers}</strong>
          </div>
        </div>
        <div className="profile-summary-grid">
          <div className="profile-summary-card">
            <span>Last shared</span>
            <strong>{formatJoinedDate(referralSummary.lastSharedAt)}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Referral rewards</span>
            <strong>KES {referralSummary.lifetimeRewardsKes}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Per activated trader</span>
            <strong>KES {referralSummary.rewardPerActivatedUserKes}</strong>
          </div>
        </div>
        <div className="button-row compact-actions">
          <button type="button" className="button" onClick={handleShareInvite}>
            Share Invite
          </button>
          <button type="button" className="button-secondary" onClick={handleShareToWorldChat}>
            Invite via World Chat
          </button>
        </div>
        <div className="soft-note">
          TMpesa now tracks invite shares, referred users, and activated traders. Automatic reward
          settlement from a wallet still requires a dedicated on-chain reward contract and
          allowlisting in the World Developer Portal.
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Push notifications</span>
            <h3>Receive transaction alerts in World App</h3>
            <p className="muted">
              Turn on World notifications so TMpesa can alert you when an order is received,
              reviewed, or completed.
            </p>
          </div>
          <span className={`status-pill ${notificationsEnabled ? "completed" : "pending"}`}>
            {notificationsEnabled ? "Enabled" : "Off"}
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
            {notificationLoading ? "Opening World permission..." : "Enable Notifications"}
          </button>
        ) : (
          <div className="notice">World push notifications are active for this TMpesa account.</div>
        )}
      </section>

      <section className="panel stack">
        <span className="brand-kicker">Trading statistics</span>
        <div className="profile-stats-list">
          <div className="profile-stat-row">
            <span>Total trades</span>
            <strong>{profileStats.totalTrades}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Fulfilled</span>
            <strong>{profileStats.fulfilled}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Completion rate</span>
            <strong>{profileStats.completionRate}%</strong>
          </div>
          <div className="profile-stat-row">
            <span>First trade</span>
            <strong>{formatJoinedDate(profileStats.firstTrade)}</strong>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Rate TMpesa</span>
            <h3>Leave a quick product rating</h3>
            <p className="muted">
              There is no official World mini app rating command in the docs yet, so TMpesa keeps
              an in-app rating pulse and can also open support for deeper feedback.
            </p>
          </div>
          <span className="status-pill completed">
            {ratingSummary.totalRatings ? `${ratingSummary.averageRating}/5` : "New"}
          </span>
        </div>
        {ratingError ? <div className="error">{ratingError}</div> : null}
        <div className="rating-button-row">
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              type="button"
              className="button-secondary"
              onClick={() => handleRateTmPesa(rating)}
            >
              {`${rating} Star${rating > 1 ? "s" : ""}`}
            </button>
          ))}
        </div>
        <div className="notice">
          Current pulse: {ratingSummary.totalRatings ? `${ratingSummary.averageRating}/5 from ${ratingSummary.totalRatings} user ratings.` : "No ratings yet."}
        </div>
      </section>

      <section className="panel stack">
        <span className="brand-kicker">Compliance and trust</span>
        <div className="profile-stats-list">
          <div className="profile-stat-row">
            <span>Wallet Auth</span>
            <strong>{user?.authMethod === "world-app" ? "Connected" : "Local only"}</strong>
          </div>
          <div className="profile-stat-row">
            <span>First-access verification</span>
            <strong>{user?.firstAccessVerified ? "Completed" : "Pending"}</strong>
          </div>
          <div className="profile-stat-row">
            <span>World username</span>
            <strong>{user?.username ? `@${user.username}` : "Unavailable"}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Notification permission</span>
            <strong>{notificationsEnabled ? "Enabled" : "Not enabled"}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Joined</span>
            <strong>{formatJoinedDate(user?.createdAt)}</strong>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Support</span>
            <h3>Quick support links</h3>
          </div>
          <Link to="/support" className="button-secondary">
            Open Support
          </Link>
        </div>
        <div className="profile-links-grid">
          <button
            type="button"
            className="profile-link-card"
            onClick={() =>
              openSupportEmail({
                subject: "TMpesa privacy request",
                body: "Hello TMpesa support,\n\nI have a privacy or account data question.",
              })
            }
          >
            <strong>Privacy and account help</strong>
            <span>Reach TMpesa support for account, data, and security questions.</span>
          </button>
          <button
            type="button"
            className="profile-link-card"
            onClick={() =>
              openWhatsAppSupport({
                message: "Hello TMpesa support,\n\nI need urgent help with my account or order.",
              })
            }
          >
            <strong>Urgent support on WhatsApp</strong>
            <span>Open a faster support path when an order or payout needs quick follow-up.</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default ProfilePage;
