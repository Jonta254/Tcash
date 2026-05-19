import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  APP_CONFIG,
  buildWorldAppDeeplink,
  getCurrentUser,
  getWorldAppContext,
  logoutUser,
} from "../../services";

const navItems = [
  { to: "/", label: "Home", icon: "HM" },
  { to: "/orders", label: "Orders", icon: "OR" },
];

function AppShell() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const worldApp = getWorldAppContext();
  const settings = useAppSettings();
  const insets = worldApp.deviceProperties?.safeAreaInsets;
  const worldAppLink = buildWorldAppDeeplink(location.pathname);
  const hasWorldSession = user?.authMethod === "world-app" || Boolean(user?.username);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
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
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-shell">
              <span className="brand-jewel" aria-hidden="true" />
              <span className="brand-status">World exchange ready</span>
            </div>
            <h1>{APP_CONFIG.appName}</h1>
          </div>
          <div className="topbar-actions">
            <NavLink to="/profile" className="profile-launch-button">
              <span className="profile-launch-avatar" aria-hidden="true">
                {(user?.username || user?.fullName || "T").slice(0, 1).toUpperCase()}
              </span>
              <span className="profile-launch-copy">
                <strong>{user?.username ? `@${user.username}` : "Profile"}</strong>
                <small>Account</small>
              </span>
            </NavLink>
            <button type="button" className="button-ghost topbar-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="context-strip">
          <span>
            {hasWorldSession
              ? "World account connected"
              : worldApp.isInstalled
                ? "Opened in World App"
                : "Open in World App for wallet payments"}
          </span>
          <span>{user?.username ? `@${user.username}` : user?.phone || "TMpesa session"}</span>
          {!hasWorldSession && !worldApp.isInstalled && settings.worldAppId ? (
            <a href={worldAppLink} className="text-link">
              Open in World App
            </a>
          ) : null}
        </div>

        <nav className={`tab-bar${user?.isAdmin ? " admin" : ""}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `tab-link${isActive ? " active" : ""}`}
            >
              <span className="tab-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {user?.isAdmin ? (
            <NavLink
              to="/admin"
              className={({ isActive }) => `tab-link${isActive ? " active" : ""}`}
            >
              <span className="tab-icon" aria-hidden="true">AD</span>
              <span>Admin</span>
            </NavLink>
          ) : null}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}

export default AppShell;
