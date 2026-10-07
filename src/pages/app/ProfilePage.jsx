import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdminSession } from "../../hooks/useAdminSession";
import { useThemeMode } from "../../hooks/useThemeMode";
import { normalizeKenyanPhone } from "../../services/tradeValidation";
import { buildWorldAppDeeplink, closeMiniApp, getCurrentUser, getWorldNotificationPermissionState,
  logoutUser, requestWorldNotificationPermission, shareMiniAppInvite, tenderHaptics,
  updateCurrentUserProfile } from "../../services";

export default function ProfilePage() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const adminSession = useAdminSession();
  const { isLightTheme, toggleTheme } = useThemeMode();
  const [phone, setPhone] = useState(user?.mpesaPhoneNumber || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getWorldNotificationPermissionState({ command: false })
      .then(state => { if (active) setNotifications(state.granted); }).catch(() => null);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (location.hash === "#notifications") document.getElementById("notifications")?.scrollIntoView();
  }, [location.hash]);
  const savePhone = () => {
    setError(""); setMessage("");
    const normalized = normalizeKenyanPhone(phone);
    if (!normalized) { setError("Enter a Kenyan M-Pesa number, such as 0712345678."); return; }
    setPhone(normalized);
    updateCurrentUserProfile({ mpesaPhoneNumber: normalized });
    tenderHaptics.commit();
    setMessage("Number saved on this device. Confirm it each time you sell.");
  };
  const enableNotifications = async () => {
    setError(""); setNotificationBusy(true);
    try {
      const state = await requestWorldNotificationPermission();
      if (!state.granted) throw new Error(state.message || "Notifications were not enabled. You can try again later.");
      setNotifications(true);
    } catch (e) { setError(e.message); }
    finally { setNotificationBusy(false); }
  };
  const share = async () => {
    setError("");
    try { await shareMiniAppInvite({ title: "Tcash", text: "Buy and sell WLD or USDC with M-Pesa in Kenya.", url: buildWorldAppDeeplink("/login") }); }
    catch (e) { setError(e.message || "Could not open sharing. Try again."); }
  };
  const signOut = async () => {
    logoutUser(); navigate("/login", { replace: true });
    await closeMiniApp().catch(() => null);
  };
  return (
    <div className="tdr-home page-enter">
      <div className="tcash-page-heading"><Link to="/" className="button-ghost">← Home</Link><h1>Profile</h1></div>
      <div className="tdr-profile-identity">
        <div className="tdr-profile-avatar" aria-hidden="true">{(user?.username || "T")[0].toUpperCase()}</div>
        <div className="tdr-profile-identity-copy"><h2 className="tdr-profile-name">{user?.username ? `@${user.username}` : "Your World wallet"}</h2><p className="muted">Signed in with World App</p></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <section className="tdr-home-section">
        <h2 className="tcash-section-title">M-Pesa payouts</h2>
        <p className="muted">Your default number for sell orders. Check the number before approving a payment.</p>
        <label className="sr-only" htmlFor="profilePayoutPhone">M-Pesa payout number</label>
        <div className="tdr-home-nudge-row"><input id="profilePayoutPhone" type="tel" autoComplete="tel-national" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712345678" /><button type="button" className="button" onClick={savePhone}>Save</button></div>
      </section>
      <section className="tdr-home-section" id="notifications">
        <h2 className="tcash-section-title">Order notifications</h2>
        <p className="muted">Get updates in World App when your order status changes. You can always check History.</p>
        {notifications ? <p className="tdr-inline-success">Notifications enabled</p> : <button className="button-secondary" type="button" disabled={notificationBusy} onClick={enableNotifications}>{notificationBusy ? "Opening World App…" : "Enable notifications"}</button>}
      </section>
      <section className="tdr-home-section">
        <h2 className="tcash-section-title">Preferences and help</h2>
        <div className="tdr-ledger-list">
          <button type="button" className="tdr-ledger-row tcash-setting-row" onClick={toggleTheme}><span>Appearance</span><strong>{isLightTheme ? "Light" : "Dark"} →</strong></button>
          <Link className="tdr-ledger-row" to="/support">Help with an order →</Link>
          <Link className="tdr-ledger-row" to="/guidelines">How Tcash works →</Link>
          <a className="tdr-ledger-row" href="/terms.html">Terms and conditions →</a>
          <a className="tdr-ledger-row" href="/privacy.html">Privacy policy →</a>
          <button className="tdr-ledger-row tcash-setting-row" type="button" onClick={share}>Share Tcash →</button>
          {adminSession === "granted" && <Link className="tdr-ledger-row" to="/tmpesa-admin">Operator desk →</Link>}
        </div>
      </section>
      <button className="button-ghost" type="button" onClick={signOut}>Sign out</button>
    </div>
  );
}
