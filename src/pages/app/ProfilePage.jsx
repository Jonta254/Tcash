import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useThemeMode } from "../../hooks/useThemeMode";
import {
  createReferralClaim,
  formatWorldLaunchSource,
  getCurrentUser,
  getOrdersForCurrentUser,
  getRatingSummary,
  getReferralSummary,
  getWorldAppContext,
  getWorldNotificationPermissionState,
  markReferralShared,
  notifyAdminReferralEvent,
  openSupportEmail,
  openWorldMiniAppRating,
  openWhatsAppSupport,
  openWorldChatInvite,
  requestWorldNotificationPermission,
  shareMiniAppInvite,
  updateCurrentUserProfile,
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
  const location = useLocation();
  const navigate = useNavigate();
  const orders = getOrdersForCurrentUser();
  const worldApp = getWorldAppContext();
  const { isLightTheme, toggleTheme } = useThemeMode();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [referralSummary, setReferralSummary] = useState(() => getReferralSummary(user));
  const [referralError, setReferralError] = useState("");
  const [referralMessage, setReferralMessage] = useState("");
  const [payoutPhone, setPayoutPhone] = useState(user?.mpesaPhoneNumber || user?.phone || "");
  const [payoutMessage, setPayoutMessage] = useState("");
  const [payoutError, setPayoutError] = useState("");
  const [ratingSummary, setRatingSummary] = useState(() => getRatingSummary());
  const [ratingError, setRatingError] = useState("");
  const notificationSectionRef = useRef(null);

  useEffect(() => {
    let active = true;

    const syncNotifications = async () => {
      const state = await getWorldNotificationPermissionState({ command: false });

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

  const nextReferralMilestone = useMemo(
    () =>
      referralSummary.rewardMilestones.find(
        (milestone) => referralSummary.activatedUsers < milestone.users,
      ) || null,
    [referralSummary],
  );

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

  useEffect(() => {
    const shouldHighlight =
      location.hash === "#notifications" ||
      Boolean(location.state?.openNotifications) ||
      Boolean(location.state?.highlightNotifications) ||
      Boolean(location.state?.fromNotificationReminder);

    if (!shouldHighlight) {
      return;
    }

    window.setTimeout(() => {
      notificationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    if (
      location.state?.openNotifications ||
      location.state?.highlightNotifications ||
      location.state?.fromNotificationReminder
    ) {
      navigate(location.pathname + location.hash, { replace: true, state: null });
    }
  }, [location.hash, location.pathname, location.state, navigate]);

  const normalizeKenyanPhone = (raw) => {
    const cleaned = raw.replace(/\s+/g, "").replace(/-/g, "");
    if (/^\+254[17]\d{8}$/.test(cleaned)) return cleaned.slice(1);
    if (/^254[17]\d{8}$/.test(cleaned)) return `0${cleaned.slice(3)}`;
    if (/^0[17]\d{8}$/.test(cleaned)) return cleaned;
    return null;
  };

  const handleSavePayoutNumber = () => {
    setPayoutError("");
    setPayoutMessage("");

    if (!payoutPhone.trim()) {
      setPayoutError("Enter the M-Pesa number TMpesa should use for payouts and rewards.");
      return;
    }

    const normalized = normalizeKenyanPhone(payoutPhone.trim());
    if (!normalized) {
      setPayoutError("Enter a valid Kenyan M-Pesa number, e.g. 0712345678 or +254712345678.");
      return;
    }

    setPayoutPhone(normalized);
    updateCurrentUserProfile({ mpesaPhoneNumber: normalized });
    setPayoutMessage("Payout number saved. TMpesa will use it for sell settlements and referral rewards.");
  };

  const handleShareInvite = async () => {
    setReferralError("");
    setReferralMessage("");

    try {
      const inviteText = `Join me on TMpesa with my invite code ${referralSummary.code}. Buy and sell WLD or USDC with M-Pesa settlement inside World App.`;
      await shareMiniAppInvite({
        title: "Join TMpesa",
        text: inviteText,
        url: referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMessage("Invite shared. TMpesa recorded the referral action.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to share invite.");
    }
  };

  const handleShareToWorldChat = async () => {
    setReferralError("");
    setReferralMessage("");

    try {
      await openWorldChatInvite({
        message: `Try TMpesa with my invite code ${referralSummary.code}. Use World App to buy or sell WLD and USDC with M-Pesa settlement.`,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMessage("World Chat invite opened. TMpesa recorded the referral action.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to open World Chat invite.");
    }
  };

  const handleOpenRating = () => {
    setRatingError("");

    try {
      openWorldMiniAppRating();
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : "Unable to open the TMpesa rating page.");
    }
  };

  const handleClaimReferralReward = async (milestoneUsers) => {
    setReferralError("");
    setReferralMessage("");

    try {
      const claim = createReferralClaim(user, milestoneUsers);
      await notifyAdminReferralEvent({
        eventType: "claim",
        referralCode: claim.referralCode,
        referrerUsername: claim.referrerUsername,
        referrerLabel: claim.referrerLabel,
        referrerMpesaPhoneNumber: claim.referrerMpesaPhoneNumber,
        referredUsers: referralSummary.referredUsers,
        activatedUsers: referralSummary.activatedUsers,
        eligibleRewardKes: claim.rewardKes,
        createdAt: claim.createdAt,
      });
      setReferralSummary(getReferralSummary(user));
      setReferralMessage("Claim request sent. TMpesa admin will review and settle the reward to your M-Pesa number.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to claim referral reward.");
    }
  };

  return (
    <div className="stack page-enter">
      <section className="panel profile-hero">
        <div className="profile-hero-head">
          <div className="profile-avatar" aria-hidden="true">
            {(user?.username || user?.fullName || "T").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span className="brand-kicker">Account</span>
              {user?.username ? (
                <span className="live-badge live-badge-small" style={{ fontSize: "0.72rem" }}>
                  World verified
                </span>
              ) : null}
            </div>
            <h2 style={{ margin: "4px 0 0", overflowWrap: "anywhere" }}>
              {user?.username ? `@${user.username}` : user?.fullName || "TMpesa user"}
            </h2>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.93rem" }}>
              Payout settings, referral rewards, and account tools.
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
        {user?.isAdmin ? (
          <div className="button-row compact-actions">
            <Link to="/tmpesa-admin" className="button">
              Open Admin Desk
            </Link>
            <div className="soft-note">Available only on the TMpesa operator account.</div>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Payout settings</span>
            <h3>Save your M-Pesa payout number</h3>
            <p className="muted">
              Save the M-Pesa number used for sell settlements and referral reward payouts. Use a number registered for M-Pesa.
            </p>
          </div>
        </div>
        {payoutError ? <div className="error">{payoutError}</div> : null}
        {payoutMessage ? <div className="notice">{payoutMessage}</div> : null}
        <div className="field">
          <label htmlFor="profilePayoutPhone">M-Pesa payout number</label>
          <input
            id="profilePayoutPhone"
            value={payoutPhone}
            onChange={(event) => setPayoutPhone(event.target.value)}
            placeholder="0712345678"
            inputMode="tel"
          />
          <span className="muted field-hint">Accepted formats: 0712345678 · +254712345678 · 254712345678</span>
        </div>
        <div className="button-row compact-actions">
          <button type="button" className="button" onClick={handleSavePayoutNumber}>
            Save payout number
          </button>
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
        <div className="button-row compact-actions">
          <button type="button" className="button-secondary" onClick={toggleTheme}>
            {isLightTheme ? "☾" : "☀"}
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Referral center</span>
            <h3>Invite new World users to TMpesa</h3>
            <p className="muted">
              Share your TMpesa link, track active traders, and claim referral rewards when a
              milestone is unlocked.
            </p>
          </div>
          <span className="status-pill paid">Code {referralSummary.code}</span>
        </div>
        {referralMessage ? <div className="notice">{referralMessage}</div> : null}
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
            <span>Paid rewards</span>
            <strong>KES {referralSummary.lifetimeRewardsKes}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Pending milestones</span>
            <strong>
              {referralSummary.pendingMilestones.length
                ? referralSummary.pendingMilestones.map((milestone) => `KES ${milestone.rewardKes}`).join(", ")
                : "None"}
            </strong>
          </div>
          <div className="profile-summary-card">
            <span>Next reward</span>
            <strong>
              {nextReferralMilestone
                ? `${nextReferralMilestone.users - referralSummary.activatedUsers} more for KES ${nextReferralMilestone.rewardKes}`
                : "All live milestones reached"}
            </strong>
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
          TMpesa records referred users, activated traders, and claim requests. Once you hit a live
          milestone, claim it here and the admin payout queue is notified for M-Pesa settlement.
        </div>
        {referralSummary.pendingMilestones.length ? (
          <div className="stack">
            <span className="brand-kicker">Claim rewards</span>
            <div className="profile-links-grid">
              {referralSummary.pendingMilestones.map((milestone) => (
                <button
                  key={milestone.users}
                  type="button"
                  className="profile-link-card"
                  onClick={() => handleClaimReferralReward(milestone.users)}
                >
                  <strong>Claim KES {milestone.rewardKes}</strong>
                  <span>{milestone.users} activated referrals reached. Request payout to your saved M-Pesa number.</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {referralSummary.claims?.length ? (
          <div className="stack">
            <span className="brand-kicker">Reward claims</span>
            <div className="profile-stats-list">
              {referralSummary.claims.slice(0, 3).map((claim) => (
                <div key={claim.id} className="profile-stat-row">
                  <span>{claim.milestoneUsers} referrals</span>
                  <strong>{claim.status.toUpperCase()} - KES {claim.rewardKes}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section
        className={`panel stack${
          location.hash === "#notifications" ? " panel-focus-ring" : ""
        }`}
        id="notifications"
        ref={notificationSectionRef}
      >
        <div className="split">
          <div>
            <span className="brand-kicker">Push notifications</span>
            <h3>Get World App order alerts</h3>
            <p className="muted">
              Turn on World notifications so TMpesa can alert you when an order is placed, reviewed, or completed. Alerts are delivered inside World App.
            </p>
          </div>
          <span className={`status-pill ${notificationsEnabled ? "completed" : "pending"}`}>
            {notificationsEnabled ? "✓ Active" : "Off"}
          </span>
        </div>
        {notificationError ? <div className="error">{notificationError}</div> : null}
        {!notificationsEnabled ? (
          <button
            type="button"
            className="button"
            onClick={handleEnableNotifications}
            disabled={notificationLoading}
            style={{ minHeight: 52 }}
          >
            {notificationLoading ? "Opening World App..." : "Enable World notifications"}
          </button>
        ) : (
          <div className="notice" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.1rem" }}>🔔</span>
            <span>World push notifications are active for your TMpesa account.</span>
          </div>
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
            <h3>Rate the live mini app</h3>
            <p className="muted">
              Open the TMpesa World mini app entry to leave your rating in the live app
              experience.
            </p>
          </div>
          <span className="status-pill completed">
            {ratingSummary.totalRatings ? `${ratingSummary.averageRating}/5` : "New"}
          </span>
        </div>
        {ratingError ? <div className="error">{ratingError}</div> : null}
        <div className="button-row compact-actions">
          <button type="button" className="button" onClick={handleOpenRating}>
            Rate in World App
          </button>
        </div>
        <div className="notice">
          {ratingSummary.totalRatings
            ? `TMpesa pulse: ${ratingSummary.averageRating}/5 from ${ratingSummary.totalRatings} stored ratings.`
            : "This opens the TMpesa World mini app entry for rating and feedback."}
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
            <span>Mini app access</span>
            <strong>{user?.authMethod === "world-app" ? "Ready" : "Local session"}</strong>
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
