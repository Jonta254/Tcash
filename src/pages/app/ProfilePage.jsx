import { useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  getOrdersForCurrentUser,
  getWorldNotificationPermissionState,
  openSupportEmail,
  openWhatsAppSupport,
  requestWorldNotificationPermission,
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);

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
            <span>Joined</span>
            <strong>{formatJoinedDate(user?.createdAt)}</strong>
          </div>
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
        <span className="brand-kicker">Legal and support</span>
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
