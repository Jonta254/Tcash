import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon from "../icons/Icon";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useThemeMode } from "../../hooks/useThemeMode";
import {
  APP_CONFIG,
  buildWorldAppDeeplink,
  closeMiniApp,
  getCurrentUser,
  getWorldAppContext,
  getWorldNotificationPermissionState,
  haptic,
  logoutUser,
  requestWorldNotificationPermission,
} from "../../services";

const NOTIFICATION_ALLOWED_STORAGE_KEY  = "worldtmpesa_notification_allowed";
const NOTIFICATION_ENTRY_PROMPT_KEY     = "worldtmpesa_notification_prompt_entry";
const NOTIFICATION_DISMISSED_KEY        = "worldtmpesa_notification_prompt_dismissed";

/* Trade is deliberately excluded from this list — it renders as the
   raised center action, not a fourth identical tab. */
const navItems = [
  { to: "/",       label: "Home",    icon: "home",    tone: "home"   },
  { to: "/wallet", label: "Wallet",  icon: "wallet",  tone: "wallet" },
  { to: "/orders", label: "History", icon: "history", tone: "orders" },
];

function AppShell() {
  const user      = getCurrentUser();
  const navigate  = useNavigate();
  const location  = useLocation();
  const worldApp  = getWorldAppContext();
  const settings  = useAppSettings();
  const { isLightTheme, toggleTheme } = useThemeMode();
  const isOnline  = useOnlineStatus();

  const insets          = worldApp.deviceProperties?.safeAreaInsets;
  const hasWorldSession = user?.authMethod === "world-app" || Boolean(user?.username);
  const isDashboard     = location.pathname === "/";
  const hasOwnHeader    = isDashboard || location.pathname === "/profile";
  const avatarLetter    = user?.username
    ? user.username[0].toUpperCase()
    : user?.fullName
    ? user.fullName[0].toUpperCase()
    : "T";

  const [showNotificationPrompt,      setShowNotificationPrompt]      = useState(false);
  const [notificationPromptLoading,   setNotificationPromptLoading]   = useState(false);
  const [notificationPromptError,     setNotificationPromptError]     = useState("");
  const [notificationRequestInFlight, setNotificationRequestInFlight] = useState(false);
  const [entryPromptKey] = useState(
    () => `${user?.id || user?.username || "tcash"}:${Date.now()}`,
  );

  /* scroll to top on route change */
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  /* notification permission check on mount */
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user || !worldApp.isInstalled) return;
      const hasPrompted      = typeof window !== "undefined" && window.sessionStorage.getItem(NOTIFICATION_ENTRY_PROMPT_KEY) === entryPromptKey;
      const dismissedAt      = typeof window !== "undefined" ? Number(window.localStorage.getItem(NOTIFICATION_DISMISSED_KEY) || 0) : 0;
      const recentlyDismissed = dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 3;
      const perm = await getWorldNotificationPermissionState({ command: false });
      if (active && perm.granted) { window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true"); setShowNotificationPrompt(false); return; }
      if (typeof window !== "undefined") window.localStorage.removeItem(NOTIFICATION_ALLOWED_STORAGE_KEY);
      if (active && !perm.granted && !hasPrompted && !recentlyDismissed) {
        if (typeof window !== "undefined") window.sessionStorage.setItem(NOTIFICATION_ENTRY_PROMPT_KEY, entryPromptKey);
        setShowNotificationPrompt(true);
      }
    };
    check();
    return () => { active = false; };
  }, [entryPromptKey, user, worldApp.isInstalled]);

  /* sync permission when tab regains focus */
  useEffect(() => {
    if (!showNotificationPrompt || !worldApp.isInstalled || notificationRequestInFlight) return undefined;
    let active = true;
    const sync = async () => {
      const perm = await getWorldNotificationPermissionState({ command: false });
      if (active && perm.granted) {
        window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
        setNotificationPromptError("");
        setNotificationPromptLoading(false);
        setShowNotificationPrompt(false);
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    sync();
    return () => { active = false; window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", onVisible); };
  }, [notificationRequestInFlight, showNotificationPrompt, worldApp.isInstalled]);

  const handleLogout = async () => {
    haptic("light");
    logoutUser();
    await closeMiniApp().catch(() => null);
    navigate("/login");
  };

  const closeNotificationPrompt = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(NOTIFICATION_DISMISSED_KEY, Date.now().toString());
    setShowNotificationPrompt(false);
  };

  const handleEnableNotifications = async () => {
    setNotificationPromptError("");
    setNotificationPromptLoading(true);
    setNotificationRequestInFlight(true);
    try {
      const perm = await requestWorldNotificationPermission();
      if (!perm.granted) {
        throw new Error(perm.message || "Approve notifications in World App, then return to Tcash.");
      }
      if (typeof window !== "undefined") window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
      setShowNotificationPrompt(false);
    } catch (error) {
      setShowNotificationPrompt(true);
      setNotificationPromptError(error instanceof Error ? error.message : "Tcash could not enable notifications right now.");
    } finally {
      setNotificationRequestInFlight(false);
      setNotificationPromptLoading(false);
    }
  };

  return (
    <div
      className="page-bg"
      style={{
        paddingTop:    insets?.top    ? `${Math.max(insets.top, 20)}px`         : undefined,
        paddingBottom: insets?.bottom ? `${Math.max(insets.bottom + 74, 88)}px` : undefined,
      }}
    >
      <div className="app-layout app-shell">

        {/* ── SHELL TOPBAR  (hidden on dashboard/profile — they have their own header) ── */}
        {!hasOwnHeader && (
          <header className="topbar topbar-shell">
            <div className="shell-brand">
              <img src="/tcash-logo.png" alt="Tcash" className="shell-brand-logo" />
              <div className="shell-brand-copy">
                <span className="shell-brand-name">{APP_CONFIG.appName}</span>
                <span className="shell-brand-status">
                  {hasWorldSession ? "World session" : "Exchange ready"}
                </span>
              </div>
            </div>

            <div className="shell-topbar-actions">
              <NavLink to="/profile" className="shell-avatar" aria-label="Profile">
                {avatarLetter}
              </NavLink>
              <button
                type="button"
                className="shell-icon-btn"
                onClick={toggleTheme}
                aria-label={isLightTheme ? "Switch to night mode" : "Switch to day mode"}
              >
                <Icon name={isLightTheme ? "moon" : "sun"} size={17} />
              </button>
              <button type="button" className="shell-exit-btn" onClick={handleLogout}>
                Exit
              </button>
            </div>
          </header>
        )}

        {/* ── OFFLINE NOTICE — a fact, not an alarm. Money-moving actions
            still fail on their own terms with their own message; this just
            stops that failure from reading as a mystery. ─────────────────── */}
        {!isOnline && (
          <div className="tdr-offline-banner" role="status">
            <span className="tdr-offline-dot" aria-hidden="true" />
            You're offline. Tcash will reconnect automatically.
          </div>
        )}

        {/* ── BOTTOM BAR — three quiet tabs + one raised action ───────────── */}
        <nav className="tab-bar" aria-label="Primary navigation">
          {navItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `tab-link tab-link-${item.tone}${isActive ? " active" : ""}`
              }
            >
              <span className="tab-link-shell">
                <span className="tab-icon" aria-hidden="true">
                  <Icon name={item.icon} size={18} strokeWidth={1.8} />
                </span>
                <span className="tab-label">{item.label}</span>
              </span>
            </NavLink>
          ))}

          <NavLink
            to="/trade"
            className={({ isActive }) => `tab-fab${isActive ? " active" : ""}`}
            onClick={() => haptic("light")}
          >
            <span className="tab-fab-button">
              <Icon name="swap" size={21} strokeWidth={2} />
            </span>
            <span className="tab-fab-label">Trade</span>
          </NavLink>

          {navItems.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `tab-link tab-link-${item.tone}${isActive ? " active" : ""}`
              }
            >
              <span className="tab-link-shell">
                <span className="tab-icon" aria-hidden="true">
                  <Icon name={item.icon} size={18} strokeWidth={1.8} />
                </span>
                <span className="tab-label">{item.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <Outlet />

        {/* ── NOTIFICATION PERMISSION PROMPT ──────────────────────────────── */}
        {showNotificationPrompt && (
          <div className="notification-prompt-overlay" role="dialog" aria-modal="true">
            <div className="notification-prompt-card">
              <button
                type="button"
                className="notification-prompt-close"
                onClick={closeNotificationPrompt}
                aria-label="Close"
              >
                <Icon name="close" size={16} strokeWidth={2.2} />
              </button>
              <div className="notif-prompt-head">
                <div className="notif-prompt-bell" aria-hidden="true">
                  <Icon name="bell" size={20} />
                </div>
                <div>
                  <span className="brand-kicker">World notifications</span>
                  <h3>Stay updated on your orders</h3>
                </div>
              </div>
              <p className="muted">
                World App alerts you the moment an order is placed, reviewed, or completed.
              </p>
              {notificationPromptError && <div className="error">{notificationPromptError}</div>}
              <div className="button-row compact-actions">
                <button
                  type="button"
                  className="button"
                  onClick={handleEnableNotifications}
                  disabled={notificationPromptLoading}
                >
                  {notificationPromptLoading ? "Opening World App…" : "Enable notifications"}
                </button>
                <button type="button" className="button-ghost" onClick={closeNotificationPrompt}>
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AppShell;
