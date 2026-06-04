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

const NOTIFICATION_ALLOWED_STORAGE_KEY = "worldtmpesa_notification_allowed";
const NOTIFICATION_ENTRY_PROMPT_KEY = "worldtmpesa_notification_prompt_entry";
const NOTIFICATION_DISMISSED_KEY = "worldtmpesa_notification_prompt_dismissed";
const navItems = [
  { to: "/", label: "Home", glyph: "\u25C8", tone: "home" },
  { to: "/wallet", label: "Wallet", glyph: "\u25CE", tone: "wallet" },
  { to: "/trade", label: "Trade", glyph: "\u21C4", tone: "trade" },
  { to: "/orders", label: "History", glyph: "\u25F7", tone: "orders" },
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
  const [notificationRequestInFlight, setNotificationRequestInFlight] = useState(false);
  const [entryPromptKey] = useState(
    () => `${user?.id || user?.username || "tmpesa"}:${Date.now()}`,
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;

    const checkNotifications = async () => {
      if (!user || !worldApp.isInstalled) {
        return;
      }

      const hasPromptedThisEntry =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(NOTIFICATION_ENTRY_PROMPT_KEY) === entryPromptKey;
      const dismissedAt =
        typeof window !== "undefined"
          ? Number(window.localStorage.getItem(NOTIFICATION_DISMISSED_KEY) || 0)
          : 0;
      const recentlyDismissed = dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 3;

      const permissionState = await getWorldNotificationPermissionState({ command: false });

      if (active && permissionState.granted) {
        window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
        setShowNotificationPrompt(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(NOTIFICATION_ALLOWED_STORAGE_KEY);
      }

      if (active && !permissionState.granted && !hasPromptedThisEntry && !recentlyDismissed) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(NOTIFICATION_ENTRY_PROMPT_KEY, entryPromptKey);
        }
        setShowNotificationPrompt(true);
      }
    };

    checkNotifications();

    return () => {
      active = false;
    };
  }, [entryPromptKey, user, worldApp.isInstalled]);

  useEffect(() => {
    if (!showNotificationPrompt || !worldApp.isInstalled || notificationRequestInFlight) {
      return undefined;
    }

    let active = true;

    const syncPermissionState = async () => {
      const permissionState = await getWorldNotificationPermissionState({ command: false });

      if (active && permissionState.granted) {
        window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
        setNotificationPromptError("");
        setNotificationPromptLoading(false);
        setShowNotificationPrompt(false);
      }
    };

    const handleForegroundSync = () => {
      if (document.visibilityState === "visible") {
        syncPermissionState();
      }
    };

    window.addEventListener("focus", syncPermissionState);
    document.addEventListener("visibilitychange", handleForegroundSync);

    syncPermissionState();

    return () => {
      active = false;
      window.removeEventListener("focus", syncPermissionState);
      document.removeEventListener("visibilitychange", handleForegroundSync);
    };
  }, [notificationRequestInFlight, showNotificationPrompt, worldApp.isInstalled]);

  const handleLogout = async () => {
    haptic("light");
    logoutUser();
    // If inside World App, close the mini app — otherwise navigate to login
    await closeMiniApp().catch(() => null);
    navigate("/login");
  };

  const closeNotificationPrompt = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NOTIFICATION_DISMISSED_KEY, Date.now().toString());
    }
    setShowNotificationPrompt(false);
  };

  const handleEnableNotifications = async () => {
    setNotificationPromptError("");
    setNotificationPromptLoading(true);
    setNotificationRequestInFlight(true);

    try {
      const permissionState = await requestWorldNotificationPermission();

      if (!permissionState.granted) {
        throw new Error("Approve notifications in World App, then return to TMpesa.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
      }

      setShowNotificationPrompt(false);
    } catch (error) {
      setShowNotificationPrompt(true);
      setNotificationPromptError(
        error instanceof Error
          ? error.message
          : "TMpesa could not enable notifications right now.",
      );
    } finally {
      setNotificationRequestInFlight(false);
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
          <div className="brand-block brand-block-compact">
            <div className="brand-shell brand-shell-compact">
              <img src="/tmpesa-icon.svg" alt="TMpesa" className="brand-logo-mark" />
              <div className="brand-inline-copy">
                <div className="brand-inline-row">
                  <h1>{APP_CONFIG.appName}</h1>
                  <span className="brand-status">
                    {hasWorldSession ? "World session" : "Exchange ready"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="topbar-actions topbar-actions-compact">
            <NavLink to="/profile" className="profile-launch-button profile-launch-button-compact">
              <span className="profile-launch-copy profile-launch-copy-compact">
                <strong>{user?.username ? `@${user.username}` : "Account"}</strong>
              </span>
            </NavLink>

            <button
              type="button"
              className="theme-toggle-button theme-toggle-button-compact"
              onClick={toggleTheme}
              aria-label={isLightTheme ? "Switch to night mode" : "Switch to day mode"}
            >
              <span className="theme-toggle-orb" aria-hidden="true" />
              <span aria-hidden="true">{isLightTheme ? "\u263E" : "\u2600"}</span>
            </button>

            <button type="button" className="button-ghost topbar-logout" onClick={handleLogout}>
              Exit
            </button>
          </div>
        </header>

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
                onClick={closeNotificationPrompt}
                aria-label="Close notification prompt"
              >
                {"\u00D7"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="notification-prompt-icon" aria-hidden="true">\ud83d\udd14</div>
                <div>
                  <span className="brand-kicker">World notifications</span>
                  <h3 style={{ margin: "6px 0 0" }}>Stay updated on your orders</h3>
                </div>
              </div>
              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Get a World App alert the moment your order is placed, reviewed, or completed. Never miss a status update.
              </p>
              {notificationPromptError ? <div className="error">{notificationPromptError}</div> : null}
              <div className="button-row compact-actions">
                <button
                  type="button"
                  className="button"
                  onClick={handleEnableNotifications}
                  disabled={notificationPromptLoading}
                  style={{ minHeight: 52 }}
                >
                  {notificationPromptLoading ? "Opening World App..." : "Enable World notifications"}
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={closeNotificationPrompt}
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
