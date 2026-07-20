import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Icon from "../../components/icons/Icon";
import { useAdminSession } from "../../hooks/useAdminSession";
import { useThemeMode } from "../../hooks/useThemeMode";
import {
  closeMiniApp,
  createReferralClaim,
  formatWorldLaunchSource,
  getCurrentUser,
  getOrdersForCurrentUser,
  getRatingSummary,
  getReferralSummary,
  getWorldAppContext,
  getWorldNotificationPermissionState,
  haptic,
  logoutUser,
  markReferralShared,
  notifyAdminReferralEvent,
  openSupportEmail,
  openWorldMiniAppRating,
  openWhatsAppSupport,
  openWorldChatInvite,
  requestWorldNotificationPermission,
  shareMiniAppInvite,
  tenderHaptics,
  updateCurrentUserProfile,
} from "../../services";

function formatJoinedDate(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/*
 * Profile as a financial identity record, not a settings dump. The
 * three-tab switcher this replaced was the only tabbed screen in the
 * app — everywhere else (Home, Wallet, Support) is one continuous
 * scroll sectioned by hairline dividers, so the tabs were also a
 * cohesion break, not just a hierarchy one. Every section here reuses
 * .tdr-receipt-line / .tdr-ledger-row — the same "record", not a
 * bespoke stat-card component — so a user's own profile reads with the
 * identical grammar as a receipt or a transaction row. Settings
 * (appearance, rating) are the last things on the page, on purpose.
 */
function ProfilePage() {
  const user = getCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const orders = getOrdersForCurrentUser();
  const worldApp = getWorldAppContext();
  const { isLightTheme, toggleTheme } = useThemeMode();
  // Server-verified — never the client's own isAdmin flag. Determines
  // only whether the Admin Desk link is worth showing; the actual
  // security boundary is AdminPage's own identical check plus every
  // privileged endpoint's own server-side authorization.
  const adminSession = useAdminSession();
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

    return { totalTrades, fulfilled, completionRate, firstTrade };
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
        throw new Error(
          permissionState.message || "World notification permission was not granted.",
        );
      }

      setNotificationsEnabled(true);
      tenderHaptics.verify();
    } catch (error) {
      tenderHaptics.warn();
      setNotificationError(
        error instanceof Error ? error.message : "Tcash could not enable notifications.",
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  // No more tab to switch back to before scrolling — the section this
  // targets is always on the page now, so a deep link just scrolls.
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
      tenderHaptics.warn();
      setPayoutError("Enter the M-Pesa number Tcash should use for payouts and rewards.");
      return;
    }

    const normalized = normalizeKenyanPhone(payoutPhone.trim());
    if (!normalized) {
      tenderHaptics.warn();
      setPayoutError("Enter a valid Kenyan M-Pesa number, e.g. 0712345678 or +254712345678.");
      return;
    }

    setPayoutPhone(normalized);
    updateCurrentUserProfile({ mpesaPhoneNumber: normalized });
    tenderHaptics.commit();
    setPayoutMessage("Saved. Tcash will use this number for sell settlements and referral rewards.");
  };

  const handleShareInvite = async () => {
    setReferralError("");
    setReferralMessage("");

    try {
      const inviteText = `Join me on Tcash with my invite code ${referralSummary.code}. Buy and sell WLD or USDC with M-Pesa settlement inside World App.`;
      await shareMiniAppInvite({
        title: "Join Tcash",
        text: inviteText,
        url: referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMessage("Invite shared. Tcash recorded the referral action.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to share invite.");
    }
  };

  const handleShareToWorldChat = async () => {
    setReferralError("");
    setReferralMessage("");

    try {
      await openWorldChatInvite({
        message: `Try Tcash with my invite code ${referralSummary.code}. Use World App to buy or sell WLD and USDC with M-Pesa settlement.`,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMessage("World Chat invite opened. Tcash recorded the referral action.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to open World Chat invite.");
    }
  };

  const handleOpenRating = () => {
    setRatingError("");

    try {
      openWorldMiniAppRating();
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : "Unable to open the Tcash rating page.");
    }
  };

  const handleExit = async () => {
    tenderHaptics.cancellation();
    logoutUser();
    await closeMiniApp().catch(() => null);
    navigate("/login");
  };

  const handleClaimReferralReward = async (milestoneUsers) => {
    setReferralError("");
    setReferralMessage("");

    try {
      const claim = await createReferralClaim(user, milestoneUsers);
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
      tenderHaptics.commit();
      setReferralSummary(getReferralSummary(user));
      setReferralMessage("Claim request sent. Tcash admin will review and settle the reward to your M-Pesa number.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to claim referral reward.");
    }
  };

  const initials = (user?.username || user?.fullName || "T").slice(0, 1).toUpperCase();
  const isWorldVerified = Boolean(user?.username);
  const isWalletConnected = user?.authMethod === "world-app";

  return (
    <div className="tdr-home page-enter">
      <h1 className="sr-only">Profile — your Tcash identity</h1>

      {/* ── identity — no card, the same "sits on the page" treatment
          as Home's balance ─────────────────────────────────────────── */}
      <div className="tdr-profile-identity">
        <div className="tdr-profile-avatar" aria-hidden="true">{initials}</div>
        <div className="tdr-profile-identity-copy">
          <h2 className="tdr-profile-name">
            {user?.username ? `@${user.username}` : user?.fullName || "Tcash user"}
          </h2>
          <div className="tdr-profile-trust-row">
            {isWorldVerified && (
              <span className="tdr-trust-verified tdr-trust-verified-stamp">
                <Icon name="check" size={11} strokeWidth={2.1} />
                World verified
              </span>
            )}
            <span className="tdr-trust-verified" data-connected={isWalletConnected}>
              {isWalletConnected ? "Wallet connected" : "Local session"}
            </span>
          </div>
        </div>
      </div>

      {/* ── reputation — the record of what this identity has actually
          done, read like a ledger, not a stat-card grid ────────────── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Reputation</span>
        </div>
        <div className="tdr-receipt-lines">
          <div className="tdr-receipt-line">
            <span>Trades completed</span>
            <strong>{profileStats.fulfilled} of {profileStats.totalTrades}</strong>
          </div>
          <div className="tdr-receipt-line">
            <span>Completion rate</span>
            <strong>{profileStats.completionRate}%</strong>
          </div>
          <div className="tdr-receipt-line">
            <span>Member since</span>
            <strong>{formatJoinedDate(user?.createdAt)}</strong>
          </div>
        </div>
      </section>

      {/* ── settlement — the one setting that's actually load-bearing
          for the sell flow, kept visible and editable, not buried ──── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Settlement</span>
        </div>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.82rem" }}>
          Where Tcash sends KES for sell orders and referral rewards.
        </p>
        {payoutError ? <p className="tdr-login-error" style={{ fontSize: "0.82rem" }}>{payoutError}</p> : null}
        {payoutMessage ? <p className="tdr-inline-success" style={{ fontSize: "0.82rem" }}>{payoutMessage}</p> : null}
        <div className="tdr-home-nudge-row">
          <input
            id="profilePayoutPhone"
            value={payoutPhone}
            onChange={(event) => setPayoutPhone(event.target.value)}
            placeholder="0712345678"
            inputMode="tel"
            aria-label="M-Pesa payout number"
          />
          <button type="button" className="button" onClick={handleSavePayoutNumber}>Save</button>
        </div>
      </section>

      {/* ── notifications ─────────────────────────────────────────── */}
      <section
        className={`tdr-home-section${location.hash === "#notifications" ? " panel-focus-ring" : ""}`}
        id="notifications"
        ref={notificationSectionRef}
      >
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Notifications</span>
          <span className={`status-pill ${notificationsEnabled ? "completed" : "pending"}`}>
            {notificationsEnabled ? "Active" : "Off"}
          </span>
        </div>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.82rem" }}>
          World App alerts you the moment an order is placed, reviewed, or completed.
        </p>
        {notificationError ? <p className="tdr-login-error" style={{ fontSize: "0.82rem" }}>{notificationError}</p> : null}
        {!notificationsEnabled && (
          <button
            type="button"
            className="button"
            onClick={handleEnableNotifications}
            disabled={notificationLoading}
          >
            {notificationLoading ? "Opening World App…" : "Enable notifications"}
          </button>
        )}
      </section>

      {/* ── security — the trust facts, stated as a record, not a
          "compliance" checklist ─────────────────────────────────────── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Security</span>
        </div>
        <div className="tdr-receipt-lines">
          <div className="tdr-receipt-line">
            <span>Wallet authentication</span>
            <strong>{isWalletConnected ? "Verified via World ID" : "Local session"}</strong>
          </div>
          <div className="tdr-receipt-line">
            <span>Launch source</span>
            <strong>{formatWorldLaunchSource(worldApp.location)}</strong>
          </div>
        </div>
        <div className="tdr-ledger-list" style={{ marginTop: 4 }}>
          <Link to="/guidelines" className="tdr-ledger-row">
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="check" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">User Guidelines</span>
              <span className="tdr-ledger-date">Trade limits, referral terms, risk disclosure</span>
            </div>
          </Link>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="tdr-ledger-row">
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="check" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Terms &amp; Conditions</span>
            </div>
          </a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="tdr-ledger-row">
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="check" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Privacy Policy</span>
            </div>
          </a>
        </div>
      </section>

      {/* ── referrals ─────────────────────────────────────────────── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Referrals</span>
        </div>
        {referralMessage ? <p className="tdr-inline-success" style={{ fontSize: "0.82rem" }}>{referralMessage}</p> : null}
        {referralError ? <p className="tdr-login-error" style={{ fontSize: "0.82rem" }}>{referralError}</p> : null}

        <div className="tdr-home-invite" style={{ borderTop: 0, paddingTop: 0 }}>
          <span className="tdr-home-invite-copy">
            Code <span className="tdr-home-invite-code">{referralSummary.code}</span>
          </span>
          <button type="button" className="tdr-home-invite-action" onClick={handleShareInvite}>Share</button>
        </div>

        <div className="tdr-receipt-lines">
          <div className="tdr-receipt-line">
            <span>New users invited</span>
            <strong>{referralSummary.referredUsers}</strong>
          </div>
          <div className="tdr-receipt-line">
            <span>Activated traders</span>
            <strong>{referralSummary.activatedUsers}</strong>
          </div>
          <div className="tdr-receipt-line">
            <span>Rewards paid</span>
            <strong>KES {referralSummary.lifetimeRewardsKes}</strong>
          </div>
          <div className="tdr-receipt-line">
            <span>Next reward</span>
            <strong>
              {nextReferralMilestone
                ? `${nextReferralMilestone.users - referralSummary.activatedUsers} more for KES ${nextReferralMilestone.rewardKes}`
                : "All live milestones reached"}
            </strong>
          </div>
        </div>

        <div className="button-row compact-actions" style={{ marginTop: 12 }}>
          <button type="button" className="button-secondary" onClick={handleShareToWorldChat}>
            Invite via World Chat
          </button>
        </div>

        {referralSummary.pendingMilestones.length ? (
          <div className="tdr-ledger-list" style={{ marginTop: 4 }}>
            {referralSummary.pendingMilestones.map((milestone) => (
              <button
                key={milestone.users}
                type="button"
                className="tdr-ledger-row"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => handleClaimReferralReward(milestone.users)}
              >
                <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="gift" size={13} strokeWidth={1.9} /></span>
                <div className="tdr-ledger-mid">
                  <span className="tdr-ledger-title">Claim KES {milestone.rewardKes}</span>
                  <span className="tdr-ledger-date">{milestone.users} activated referrals reached</span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* ── preferences — secondary, on purpose, near the bottom ────── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Preferences</span>
        </div>
        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-row-icon">
              <Icon name={isLightTheme ? "sun" : "moon"} size={18} />
            </div>
            <div className="settings-row-text">
              <strong>Appearance</strong>
              <span className="muted">{isLightTheme ? "Light mode" : "Dark mode"}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!isLightTheme}
              aria-label="Toggle dark mode"
              className={`theme-switch${!isLightTheme ? " on" : ""}`}
              onClick={toggleTheme}
            >
              <span className="theme-switch-thumb" />
            </button>
          </div>
        </div>
        <div className="tdr-receipt-line" style={{ marginTop: 4 }}>
          <span>Rate Tcash</span>
          <strong>{ratingSummary.totalRatings ? `${ratingSummary.averageRating}/5` : "New"}</strong>
        </div>
        {ratingError ? <p className="tdr-login-error" style={{ fontSize: "0.82rem" }}>{ratingError}</p> : null}
        <div className="button-row compact-actions" style={{ marginTop: 10 }}>
          <button type="button" className="button-secondary" onClick={handleOpenRating}>Rate in World App</button>
        </div>
      </section>

      {/* ── support — secondary ──────────────────────────────────── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Support</span>
          <Link to="/support" className="tdr-home-section-link">All →</Link>
        </div>
        <div className="tdr-ledger-list">
          <button
            type="button"
            className="tdr-ledger-row"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() =>
              openSupportEmail({
                subject: "Tcash privacy request",
                body: "Hello Tcash support,\n\nI have a privacy or account data question.",
              })
            }
          >
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="mail" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Email support</span>
              <span className="tdr-ledger-date">Account, data, and security questions</span>
            </div>
          </button>
          <button
            type="button"
            className="tdr-ledger-row"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() =>
              openWhatsAppSupport({
                message: "Hello Tcash support,\n\nI need urgent help with my account or order.",
              })
            }
          >
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="chat" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">WhatsApp support</span>
              <span className="tdr-ledger-date">Faster path for a delayed order or payout</span>
            </div>
          </button>
        </div>
      </section>

      {adminSession === "granted" && (
        <Link to="/tmpesa-admin" className="button" style={{ textAlign: "center" }}>
          Open Admin Desk
        </Link>
      )}

      <button type="button" className="profile-logout-btn" onClick={handleExit}>
        <Icon name="logout" size={18} />
        Log out
      </button>
    </div>
  );
}

export default ProfilePage;
