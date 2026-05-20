import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useThemeMode } from "../../hooks/useThemeMode";
import {
  APP_CONFIG,
  buildWorldAppDeeplink,
  getCurrentUser,
  getWorldAppContext,
  getWorldNotificationPermissionState,
  logoutUser,
  requestWorldNotificationPermission,
} from "../../services";

const navItems = [
  { to: "/", label: "Home", glyph: "◈", tone: "home" },
  { to: "/wallet", label: "Wallet", glyph: "◎", tone: "wallet" },
  { to: "/trade", label: "Trade", glyph: "⇄", tone: "trade" },
  { to: "/orders", label: "Orders", glyph: "◷", tone: "orders" },
];

function AppShell() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const worldApp = getWorldAppContext();
  const settings = useAppSettings();
  const { isLightTheme, toggleTheme } = useThemeMode();
  const insets = worldApp.deviceProperties?.safeAreaInsets;
  const worldAppLink = buildWorldAppDeeplink(location.pathname);
  const hasWorldSession = user?.authMethod === "world-app" || Boolean(user?.username);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationPromptLoading, setNotificationPromptLoading] = useState(false);
  const [notificationPromptError, setNotificationPromptError] = useState("");

  useEffect(() => {
    let active = true;

    const checkNotifications = async () => {
      if (!user || !worldApp.isInstalled) {
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
  }, [user, worldApp.isInstalled, location.pathname]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
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
    } catch (error) {
      setNotificationPromptError(
        error instanceof Error ? error.message : "TMpesa could not enable notifications.",
      );
    } finally {
      setNotificationPromptLoading(false);
    }
  };

  return (
    <div
      className="page-bg"
      style={{
        paddingTop: insets?.top ? `${Math.max(insets.top, 20)}px` : undefined,
        paddingBottom: insets?.bottom ? `${Math.max(insets.bottom + 104, 120)}px` : undefined,
      }}
    >
      <div className="app-layout app-shell">
        <header className="topbar topbar-shell">
          <div className="brand-block">
            <div className="brand-shell">
              <span className="brand-jewel" aria-hidden="true" />
              <span className="brand-status">World exchange ready</span>
            </div>
            <div className="brand-headline">
              <h1>{APP_CONFIG.appName}</h1>
              <small>{hasWorldSession ? "Settlement wallet connected" : "Kenya settlement wallet"}</small>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="theme-toggle-button"
              onClick={toggleTheme}
              aria-label={isLightTheme ? "Switch to night mode" : "Switch to day mode"}
            >
              <span className="theme-toggle-orb" aria-hidden="true" />
              <span aria-hidden="true">{isLightTheme ? "☾" : "☀"}</span>
            </button>

            <NavLink to="/profile" className="profile-launch-button">
              <span className="profile-launch-avatar" aria-hidden="true">
                {(user?.username || user?.fullName || "T").slice(0, 1).toUpperCase()}
              </span>
              <span className="profile-launch-copy">
                <strong>{user?.username ? `@${user.username}` : "Profile"}</strong>
                <small>{user?.isAdmin ? "Admin profile" : "Account"}</small>
              </span>
            </NavLink>

            <button type="button" className="button-ghost topbar-logout" onClick={handleLogout}>
              Exit
            </button>
          </div>
        </header>

        <div className="context-strip context-strip-compact">
          <span>{hasWorldSession ? "World account connected" : "Open in World App for wallet payments"}</span>
          <span>
            {user?.isAdmin
              ? user?.username
                ? `@${user.username} • Admin`
                : "Admin session"
              : user?.username
                ? `@${user.username}`
                : user?.phone || "TMpesa session"}
          </span>
          {!hasWorldSession && !worldApp.isInstalled && settings.worldAppId ? (
            <a href={worldAppLink} className="text-link">
              Open in World App
            </a>
          ) : null}
        </div>

        <nav className="tab-bar" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `tab-link tab-link-${item.tone}${isActive ? " active" : ""}`}
            >
              <span className="tab-link-shell">
                <span className="tab-icon" aria-hidden="true">
                  {item.glyph}
                </span>
                <span className="tab-label">{item.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <Outlet />

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
              <div className="notification-prompt-icon" aria-hidden="true">
                ✦
              </div>
              <div className="stack">
                <span className="brand-kicker">World notifications</span>
                <h3>Stay updated on every TMpesa order</h3>
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

export default AppShell;
