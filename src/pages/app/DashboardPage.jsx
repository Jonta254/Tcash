import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/icons/Icon";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  getCachedWorldWalletPortfolio,
  calculateKesWalletBalance,
  fetchWorldMarketRates,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getOrdersForCurrentUser,
  getReferralSummary,
  getWorldWalletPortfolio,
  haptic,
  markReferralShared,
  shareMiniAppInvite,
  tenderHaptics,
  updateCurrentUserProfile,
} from "../../services";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function statusColor(s) {
  if (s === "completed")                     return "var(--success)";
  if (s === "paid")                          return "var(--primary)";
  if (s === "rejected" || s === "cancelled") return "var(--error)";
  return "var(--gold)";
}
function statusLabel(s) {
  if (s === "paid")                          return "Reviewing";
  if (s === "completed")                     return "Done";
  if (s === "rejected" || s === "cancelled") return "Failed";
  return "Pending";
}

export default function DashboardPage() {
  const initialUser      = getCurrentUser();
  const initialPortfolio = getCachedWorldWalletPortfolio(initialUser?.walletAddress);

  const [user,            setUser]            = useState(initialUser);
  const [profilePhone,    setProfilePhone]    = useState(initialUser?.mpesaPhoneNumber || initialUser?.phone || "");
  const [profileMsg,      setProfileMsg]      = useState("");
  const [profileErr,      setProfileErr]      = useState("");
  const [walletPortfolio, setWalletPortfolio] = useState(() => initialPortfolio);
  const [walletLoading,   setWalletLoading]   = useState(false);
  const [walletError,     setWalletError]     = useState("");
  const [mktRefreshing,   setMktRefreshing]   = useState(false);
  const [wltRefreshing,   setWltRefreshing]   = useState(false);
  const [referralSummary, setReferralSummary] = useState(() => getReferralSummary(initialUser));
  const [referralMsg,     setReferralMsg]     = useState("");
  const liveRates = useExchangeRates();

  // max 2 orders — keeps home compact
  const recentOrders = useMemo(
    () => getOrdersForCurrentUser()
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );

  const mktRates = useMemo(() => [
    { asset: "WLD",  kes: Number(liveRates?.WLD)  || 0 },
    { asset: "USDC", kes: Number(liveRates?.USDC) || 0 },
  ], [liveRates]);

  const hasLiveRates = mktRates.every(r => r.kes > 1);

  const walletBoard = useMemo(() => {
    const assets = walletPortfolio.assets.map(a => ({
      ...a, marketPriceKes: Number(liveRates[a.symbol] || 0),
    }));
    return {
      assets,
      totalKes: calculateKesWalletBalance(assets, liveRates),
      wld:  assets.find(a => a.symbol === "WLD"),
      usdc: assets.find(a => a.symbol === "USDC"),
    };
  }, [liveRates, walletPortfolio.assets]);

  const hasBalances = useMemo(
    () => walletPortfolio.assets.some(a => Number(a.formattedBalance || 0) > 0),
    [walletPortfolio.assets],
  );

  const loadPortfolio = useCallback(async ({ showErrors = false } = {}) => {
    if (!user?.walletAddress) {
      setWalletPortfolio({ walletAddress: "", assets: [], supported: false });
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    setWalletError("");
    try {
      setWalletPortfolio(await getWorldWalletPortfolio(user.walletAddress));
    } catch (e) {
      const cached = getCachedWorldWalletPortfolio(user.walletAddress);
      if (cached.assets.length) setWalletPortfolio(cached);
      else {
        setWalletPortfolio({ walletAddress: user.walletAddress, assets: [], supported: true });
        if (showErrors) setWalletError(e instanceof Error ? e.message : "Unable to refresh.");
      }
    } finally { setWalletLoading(false); }
  }, [user?.walletAddress]);

  useEffect(() => { loadPortfolio().catch(() => null); }, [loadPortfolio]);

  const normalizePhone = raw => {
    const c = raw.replace(/[\s-]/g, "");
    if (/^\+254[17]\d{8}$/.test(c)) return c.slice(1);
    if (/^254[17]\d{8}$/.test(c))   return `0${c.slice(3)}`;
    if (/^0[17]\d{8}$/.test(c))     return c;
    return null;
  };

  const handleSavePhone = () => {
    setProfileErr(""); setProfileMsg("");
    if (!profilePhone.trim()) { setProfileErr("Enter your M-Pesa number."); return; }
    const n = normalizePhone(profilePhone.trim());
    if (!n) { setProfileErr("Use format 0712345678"); return; }
    setProfilePhone(n);
    setUser(updateCurrentUserProfile({ mpesaPhoneNumber: n }));
    haptic("success");
    setProfileMsg("Saved ✓");
  };

  const handleRefreshWallet = async () => {
    setWltRefreshing(true); haptic("light");
    try { await loadPortfolio({ showErrors: true }); }
    finally { setWltRefreshing(false); }
  };

  const handleRefreshRates = async () => {
    setMktRefreshing(true); haptic("light");
    try {
      await fetchWorldMarketRates();
      tenderHaptics.bridgeComplete();
    }
    catch { /* silent — rates stay cached */ }
    finally { setMktRefreshing(false); }
  };

  const handleShare = async () => {
    haptic("medium");
    try {
      await shareMiniAppInvite({
        title: "Join Tcash",
        text:  `Use code ${referralSummary.code} to trade WLD & USDC with M-Pesa in World App.`,
        url:   referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMsg("Shared!");
      setTimeout(() => setReferralMsg(""), 2500);
    } catch { /* silent */ }
  };

  const balanceLabel = useMemo(() => {
    if (!user?.walletAddress)          return "KES —";
    if (!hasLiveRates && !hasBalances) return "KES —";
    return formatKES(walletBoard.totalKes);
  }, [hasLiveRates, hasBalances, user?.walletAddress, walletBoard.totalKes]);

  const balanceSub = useMemo(() => {
    if (!user?.walletAddress)                             return "Connect World wallet";
    if (wltRefreshing || (walletLoading && !hasBalances)) return "Syncing…";
    if (walletError && !hasBalances)                      return "Sync failed · tap ↻";
    return "Portfolio in KES";
  }, [hasBalances, user?.walletAddress, walletError, walletLoading, wltRefreshing]);

  const assetAmt = useCallback(entry => {
    // 2 dp on the home chip so the balance never clips beside the live rate.
    if (entry) return formatCryptoAmount(entry.formattedBalance, 2);
    if (!user?.walletAddress || walletLoading) return "—";
    return "0";
  }, [user?.walletAddress, walletLoading]);

  const greeting    = getGreeting();
  const displayName = user?.username ? `@${user.username}` : user?.fullName || null;
  const hasWorld    = Boolean(user?.username);
  const initials    = (user?.username || user?.fullName || "T")[0].toUpperCase();

  return (
    <div className="tdr-home page-enter">

      {/* ── identity ─────────────────────────────────────────── */}
      <div className="tdr-home-topline">
        <div className="tdr-home-brand">
          <span className="tdr-home-brand-word">Tcash</span>
          {hasWorld && (
            <span className="tdr-trust-verified tdr-trust-verified-stamp">
              <Icon name="check" size={11} strokeWidth={2.1} />
              World verified
            </span>
          )}
        </div>
        <Link to="/profile" className="shell-avatar" aria-label="Profile">{initials}</Link>
      </div>

      {/* ── balance — no card, sits directly on the page ────────── */}
      <div>
        <p className="tdr-home-greeting">{greeting}{displayName ? `, ${displayName}` : ""}</p>
        <div className="tdr-home-balance-row">
          <strong className="tdr-home-balance-num">{balanceLabel}</strong>
          <button type="button" className="tdr-home-refresh" onClick={handleRefreshWallet} aria-label="Refresh balance">
            <span className={wltRefreshing ? "spin" : ""}><Icon name="refresh" size={13} strokeWidth={2} /></span>
          </button>
        </div>
        <div className="tdr-home-balance-meta">
          <span>{balanceSub}</span>
          <Link to="/wallet">Wallet →</Link>
        </div>
        {walletError && !hasBalances && <p className="tdr-login-error" style={{ marginTop: 6 }}>{walletError}</p>}
      </div>

      {/* ── the Bridge — what this app actually does, drawn once ─ */}
      <div className="tdr-bridge">
        <div className="tdr-bridge-col">
          <span className="tdr-bridge-label">Crypto</span>
          <div className="tdr-bridge-asset-row">
            <span className="tdr-bridge-asset-amt">{assetAmt(walletBoard.wld)}</span>
            <span className="tdr-bridge-asset-sym">WLD</span>
          </div>
          {mktRates[0].kes > 1 && <span className="tdr-bridge-asset-rate">@ {formatKES(mktRates[0].kes)}</span>}
          <div className="tdr-bridge-asset-row">
            <span className="tdr-bridge-asset-amt">{assetAmt(walletBoard.usdc)}</span>
            <span className="tdr-bridge-asset-sym">USDC</span>
          </div>
          {mktRates[1].kes > 1 && <span className="tdr-bridge-asset-rate">@ {formatKES(mktRates[1].kes)}</span>}
        </div>

        <button type="button" className="tdr-bridge-core" onClick={handleRefreshRates} aria-label="Refresh rates">
          <span className="tdr-bridge-line"><span className={mktRefreshing ? "" : "tdr-bridge-dot"} /></span>
        </button>

        <div className="tdr-bridge-col tdr-bridge-col-right">
          <span className="tdr-bridge-label">Settles as</span>
          <span className="tdr-bridge-kes-figure">KES</span>
        </div>
      </div>

      {/* ── the one thing you came here to do ────────────────────── */}
      <div>
        <nav className="tdr-trade-split tdr-trade-split-cta" aria-label="Trade">
          <Link to="/trade?tab=buy" className="tdr-trade-half">
            <span className="tdr-trade-half-label">
              <Icon name="arrowUp" size={14} strokeWidth={2.2} />
              Buy
            </span>
            <span className="tdr-trade-half-sub">Pay KES</span>
          </Link>
          <Link to="/trade?tab=sell" className="tdr-trade-half">
            <span className="tdr-trade-half-label">
              <Icon name="arrowDown" size={14} strokeWidth={2.2} />
              Sell
            </span>
            <span className="tdr-trade-half-sub">Receive KES</span>
          </Link>
        </nav>
        <div className="tdr-home-util-row" style={{ marginTop: 14 }}>
          <Link to="/wallet#receive" className="tdr-home-util-link">Receive</Link>
          <Link to="/orders" className="tdr-home-util-link">History</Link>
        </div>
      </div>

      {/* ── setup nudge (only when M-Pesa number missing) ────────── */}
      {!user?.isAdmin && !user?.mpesaPhoneNumber && (
        <section className="tdr-home-nudge">
          <div>
            <strong style={{ fontSize: "0.9rem" }}>Add your M-Pesa number</strong>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>
              Required before Tcash can pay out a sell order.
            </p>
          </div>
          {profileErr && <p className="tdr-login-error" style={{ fontSize: "0.8rem" }}>{profileErr}</p>}
          {profileMsg && <p className="tdr-inline-success" style={{ fontSize: "0.8rem" }}>{profileMsg}</p>}
          <div className="tdr-home-nudge-row">
            <input
              value={profilePhone}
              onChange={e => setProfilePhone(e.target.value)}
              placeholder="0712345678"
              inputMode="tel"
              aria-label="M-Pesa payout number"
            />
            <button type="button" className="button" onClick={handleSavePhone}>Save</button>
          </div>
        </section>
      )}

      {/* ── recent activity — ledger lines, not cards ────────────── */}
      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Recent</span>
          {recentOrders.length > 0 && <Link to="/orders" className="tdr-home-section-link">All →</Link>}
        </div>
        {recentOrders.length > 0 ? (
          <div className="tdr-ledger-list">
            {recentOrders.map(o => (
              <Link key={o.id} to="/orders" className="tdr-ledger-row">
                <span className="tdr-ledger-icon" aria-hidden="true">
                  <Icon name={o.type === "buy" ? "arrowUp" : "arrowDown"} size={13} strokeWidth={2.2} />
                </span>
                <div className="tdr-ledger-mid">
                  <span className="tdr-ledger-title">
                    {o.cryptoAmount ? `${formatCryptoAmount(o.cryptoAmount)} ` : ""}{o.asset}
                  </span>
                  <span className="tdr-ledger-date">{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="tdr-ledger-right">
                  <span className="tdr-ledger-amt">{formatKES(o.kesAmount)}</span>
                  <span className="tdr-ledger-status" style={{ color: statusColor(o.status) }}>
                    {statusLabel(o.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="tdr-home-empty">No orders yet. Buy or sell to start your history.</p>
        )}
      </section>

      {/* ── invite — one quiet line, not a competing card ────────── */}
      <div className="tdr-home-invite">
        <span className="tdr-home-invite-copy">
          Invite a friend · code <span className="tdr-home-invite-code">{referralSummary.code}</span>
        </span>
        {referralMsg
          ? <span className="tdr-home-invite-copy" style={{ color: "var(--success)" }}>{referralMsg}</span>
          : <button type="button" className="tdr-home-invite-action" onClick={handleShare}>Share</button>}
      </div>

    </div>
  );
}
