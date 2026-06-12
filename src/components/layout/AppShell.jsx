import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
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

const navItems = [
  { to: "/",       label: "Home",    icon: "⌂",  tone: "home"   },
  { to: "/wallet", label: "Wallet",  icon: "◎",  tone: "wallet" },
  { to: "/trade",  label: "Trade",   icon: "⇄",  tone: "trade"  },
  { to: "/orders", label: "History", icon: "◷",  tone: "orders" },
];

function AppShell() {
  const user      = getCurrentUser();
  const navigate  = useNavigate();
  const location  = useLocation();
  const worldApp  = getWorldAppContext();
  const settings  = useAppSettings();
  const { isLightTheme, toggleTheme } = useThemeMode();

  const insets          = worldApp.deviceProperties?.safeAreaInsets;
  const hasWorldSession = user?.authMethod === "world-app" || Boolean(user?.username);
  const isDashboard     = location.pathname === "/";
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
    () => `${user?.id || user?.username || "tmpesa"}:${Date.now()}`,
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
        throw new Error(perm.message || "Approve notifications in World App, then return to TMpesa.");
      }
      if (typeof window !== "undefined") window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
      setShowNotificationPrompt(false);
    } catch (error) {
      setShowNotificationPrompt(true);
      setNotificationPromptError(error instanceof Error ? error.message : "TMpesa could not enable notifications right now.");
    } finally {
      setNotificationRequestInFlight(false);
      setNotificationPromptLoading(false);
    }
  };

  return (
    <div
      className="page-bg"
      style={{
        paddingTop:    insets?.top    ? `${Math.max(insets.top, 20)}px`          : undefined,
        paddingBottom: insets?.bottom ? `${Math.max(insets.bottom + 104, 120)}px` : undefined,
      }}
    >
      <div className="app-layout app-shell">

        {/* ── SHELL TOPBAR  (hidden on dashboard — dash has its own header) ── */}
        {!isDashboard && (
          <header className="topbar topbar-shell">
            <div className="shell-brand">
              <img src="/tmpesa-icon.svg" alt="TMpesa" className="shell-brand-logo" />
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
                {isLightTheme ? "☽" : "☀"}
              </button>
              <button type="button" className="shell-exit-btn" onClick={handleLogout}>
                Exit
              </button>
            </div>
          </header>
        )}

        {/* ── BOTTOM TAB BAR ──────────────────────────────────────────────── */}
        <nav className="tab-bar" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `tab-link tab-link-${item.tone}${isActive ? " active" : ""}`
              }
            >
              <span className="tab-link-shell">
                <span className="tab-icon" aria-hidden="true">{item.icon}</span>
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
                ×
              </button>
              <div className="notif-prompt-head">
                <div className="notif-prompt-bell" aria-hidden="true">🔔</div>
                <div>
                  <span className="brand-kicker">World notifications</span>
                  <h3>Stay updated on your orders</h3>
                </div>
              </div>
              <p className="muted">
                Get a World App alert the moment your order is placed, reviewed, or completed.
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
