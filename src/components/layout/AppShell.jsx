import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "../icons/Icon";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { getCurrentUser, getWorldAppContext, haptic } from "../../services";

const navItems = [
  { to: "/", label: "Home", icon: "home", tone: "home" },
  { to: "/wallet", label: "Wallet", icon: "wallet", tone: "wallet" },
  { to: "/orders", label: "History", icon: "history", tone: "orders" },
];
const titles = { "/wallet": "Your wallet", "/orders": "Order history", "/trade": "Buy and sell", "/support": "Help and support", "/guidelines": "How Tcash works", "/tmpesa-admin": "Operator desk", "/admin": "Operator desk" };
export default function AppShell() {
  const user = getCurrentUser();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const insets = getWorldAppContext().deviceProperties?.safeAreaInsets;
  const hasOwnHeader = location.pathname === "/" || location.pathname === "/profile";
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, location.hash]);
  return (
    <div className="page-bg" style={{ paddingTop: insets?.top ? `${Math.max(insets.top, 20)}px` : undefined,
      paddingBottom: insets?.bottom ? `${Math.max(insets.bottom + 74, 88)}px` : undefined }}>
      <div className="app-layout app-shell">
        {!hasOwnHeader && <header className="topbar topbar-shell">
          <NavLink to="/" className="shell-brand" aria-label="Tcash home"><span className="tdr-home-brand-word">Tcash</span><span className="tcash-shell-title">{titles[location.pathname]}</span></NavLink>
          <NavLink to="/profile" className="shell-avatar" aria-label="Profile">{(user?.username || "T")[0].toUpperCase()}</NavLink>
        </header>}
        {!isOnline && <div className="tdr-offline-banner" role="status"><span className="tdr-offline-dot" aria-hidden="true" />You're offline. Reconnect before making a payment.</div>}
        <main id="main-content"><Outlet /></main>
        <nav className="tab-bar" aria-label="Primary navigation" style={{ paddingBottom: insets?.bottom ? `${insets.bottom}px` : undefined }}>
          {navItems.slice(0, 2).map(item => <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `tab-link tab-link-${item.tone}${isActive ? " active" : ""}`}><span className="tab-link-shell"><span className="tab-icon" aria-hidden="true"><Icon name={item.icon} size={18} strokeWidth={1.8} /></span><span className="tab-label">{item.label}</span></span></NavLink>)}
          <NavLink to="/trade" className={({ isActive }) => `tab-fab${isActive ? " active" : ""}`} onClick={() => haptic("light")}><span className="tab-fab-button"><Icon name="swap" size={21} /></span><span className="tab-fab-label">Trade</span></NavLink>
          {navItems.slice(2).map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `tab-link tab-link-${item.tone}${isActive ? " active" : ""}`}><span className="tab-link-shell"><span className="tab-icon" aria-hidden="true"><Icon name={item.icon} size={18} /></span><span className="tab-label">{item.label}</span></span></NavLink>)}
        </nav>
      </div>
    </div>
  );
}
