import { normalizeKenyanPhone } from "../../services/tradeValidation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/icons/Icon";
import AnimatedFigure from "../../components/interaction/AnimatedFigure";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  getCachedWorldWalletPortfolio,
  calculateKesWalletBalance,
  fetchWorldMarketRates,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getOrdersForCurrentUser,
  buildWorldAppDeeplink,
  fetchSharedAdminOrders,
  getWorldWalletPortfolio,
  haptic,
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
  const [recentOrders, setRecentOrders] = useState(() => getOrdersForCurrentUser().slice(0, 2));
  const [rateError, setRateError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [shareMessage,     setShareMessage]     = useState("");
  const liveRates = useExchangeRates();

  useEffect(() => {
    let active = true;
    fetchSharedAdminOrders().then((payload) => {
      if (!active) return;
      setRecentOrders(getOrdersForCurrentUser().slice(0, 2));
      if (!payload?.ok) setHistoryError("History could not refresh. Open History to try again.");
    }).catch(() => { if (active) setHistoryError("History could not refresh. Open History to try again."); });
    return () => { active = false; };
  }, []);

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
      if (cached.assets.length) { setWalletPortfolio(cached); setWalletError("Showing saved balances. Refresh to try again."); }
      else {
        setWalletPortfolio({ walletAddress: user.walletAddress, assets: [], supported: true });
        setWalletError("Wallet balances are unavailable. Refresh to try again.");
      }
    } finally { setWalletLoading(false); }
  }, [user?.walletAddress]);

  useEffect(() => { loadPortfolio().catch(() => null); }, [loadPortfolio]);

  const handleSavePhone = () => {
    setProfileErr(""); setProfileMsg("");
    if (!profilePhone.trim()) { setProfileErr("Enter your M-Pesa number."); return; }
    const n = normalizeKenyanPhone(profilePhone.trim());
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
    setMktRefreshing(true); setRateError(""); haptic("light");
    try {
      await fetchWorldMarketRates();
      tenderHaptics.bridgeComplete();
    }
    catch { setRateError("Rates could not refresh. Try again before trading."); }
    finally { setMktRefreshing(false); }
  };

  const handleShare = async () => {
    haptic("medium");
    try {
      await shareMiniAppInvite({
        title: "Join Tcash",
        text: "Buy and sell WLD or USDC with M-Pesa in Kenya.",
        url: buildWorldAppDeeplink("/login"),
      });
      setShareMessage("Shared!");
      setTimeout(() => setShareMessage(""), 2500);
    } catch { setShareMessage("Sharing did not open. Try again."); }
  };

  // The hero figure is a real number only once we have a wallet and
  // either live rates or held balances; before that it's the "KES —"
  // placeholder. Animate the total unconditionally (hook must run every
  // render) and show it only in the real branch — the first meaningful
  // value snaps, later refreshes roll (see useAnimatedNumber).
  const showBalanceFigure =
    Boolean(user?.walletAddress) && hasLiveRates && walletPortfolio.assets.length > 0;
  const animatedTotal = useAnimatedNumber(showBalanceFigure ? walletBoard.totalKes : 0, {
    countUpOnFirst: true,
    duration: 700,
  });
  const balanceLabel = showBalanceFigure ? formatKES(animatedTotal) : "KES —";

  const balanceSub = useMemo(() => {
    if (!user?.walletAddress)                             return "Connect World wallet";
    if (wltRefreshing || (walletLoading && !hasBalances)) return "Syncing…";
    if (walletError && !hasBalances)                      return "Sync failed · tap ↻";
    return "Estimated wallet value · not a cash balance";
  }, [hasBalances, user?.walletAddress, walletError, walletLoading, wltRefreshing]);

  const assetAmt = useCallback(entry => {
    // 2 dp on the home chip so the balance never clips beside the live rate.
    if (entry) return formatCryptoAmount(entry.formattedBalance, 2);
    return "—";
  }, [user?.walletAddress, walletLoading]);

  // Two labelled columns, one row per asset: "Holdings" on the left (what you
  // own, and what it's worth), "Market rates" on the right (what one coin costs
  // right now). The old three-column "bridge" put the rate directly under the
  // balance with no separation, so "@ KES 50.29" read as the holding's value,
  // and its right column ("Settles as KES") only repeated the hero figure's
  // own "Portfolio in KES". Splitting your-money from market-price by column
  // is what makes the two unmistakable. The ≈ values sum to the hero figure.
  const holdings = useMemo(
    () =>
      [
        { symbol: "WLD", entry: walletBoard.wld, kes: mktRates[0].kes },
        { symbol: "USDC", entry: walletBoard.usdc, kes: mktRates[1].kes },
      ].map(({ symbol, entry, kes }) => {
        const hasRate = kes > 1;
        const balance = Number(entry?.formattedBalance || 0);

        return {
          symbol,
          amountLabel: `${assetAmt(entry)} ${symbol}`,
          hasRate,
          hasValue: hasRate && Boolean(entry),
          valueKes: balance * kes,
          rateKes: kes,
          perLabel: `per ${symbol}`,
        };
      }),
    [assetAmt, mktRates, walletBoard.usdc, walletBoard.wld],
  );

  const greeting    = getGreeting();
  const displayName = user?.username ? `@${user.username}` : user?.fullName || null;
  const hasWorld    = Boolean(user?.username);
  const initials    = (user?.username || user?.fullName || "T")[0].toUpperCase();

  return (
    <div className="tdr-home page-enter">
      <h1 className="sr-only">Tcash home</h1>

      {/* ── identity ─────────────────────────────────────────── */}
      <div className="tdr-home-topline">
        <div className="tdr-home-brand">
          <span className="tdr-home-brand-word">Tcash</span>
          {hasWorld && (
            <span className="tdr-trust-verified tdr-trust-verified-stamp">
              <Icon name="check" size={11} strokeWidth={2.1} />
              Wallet connected
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
          <button type="button" className="tdr-home-refresh" onClick={handleRefreshWallet} aria-label="Refresh balance" disabled={wltRefreshing}>
            <span className={wltRefreshing ? "spin" : ""}><Icon name="refresh" size={13} strokeWidth={2} /></span>
          </button>
        </div>
        <div className="tdr-home-balance-meta">
          <span>{balanceSub}</span>
          <Link to="/wallet">Wallet →</Link>
        </div>
        {walletError && <p className="tdr-login-error" style={{ marginTop: 6 }}>{walletError}</p>}
      </div>

      {/* ── holdings: balance, live unit price, and KES value per asset ── */}
      <section className="tdr-hold" aria-label="Your holdings">
        <div className="tdr-hold-head">
          <span className="tdr-bridge-label">Holdings</span>
          <button
            type="button"
            className="tdr-hold-live"
            onClick={handleRefreshRates}
            aria-label="Refresh live rates"
            disabled={mktRefreshing}
          >
            <span className={mktRefreshing ? "" : "tdr-hold-dot"} />
            {mktRefreshing ? "Updating" : hasLiveRates ? "Market rates" : "Rates unavailable"}
            <span className={mktRefreshing ? "spin" : ""}>
              <Icon name="refresh" size={12} strokeWidth={2} />
            </span>
          </button>
        </div>

        {holdings.map((holding) => (
          <div className="tdr-hold-row" key={holding.symbol}>
            <div className="tdr-hold-cell">
              <span className="tdr-hold-amt">{holding.amountLabel}</span>
              {holding.hasValue ? (
                <AnimatedFigure
                  className="tdr-hold-sub"
                  value={holding.valueKes}
                  prefix="≈ "
                  format={formatKES}
                />
              ) : (
                <span className="tdr-hold-sub">≈ —</span>
              )}
            </div>
            <div className="tdr-hold-cell tdr-hold-cell-end">
              {holding.hasRate ? (
                <AnimatedFigure
                  className="tdr-hold-rate"
                  value={holding.rateKes}
                  format={formatKES}
                />
              ) : (
                <span className="tdr-hold-rate">—</span>
              )}
              <span className="tdr-hold-sub">{holding.perLabel}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ── the one thing you came here to do ────────────────────── */}
      <div>
        {/* Two full-width paths rather than two words in a thin bordered
            strip: each states the direction money moves, so a first-time
            user picks the right one without having to infer what "Pay KES"
            vs "Receive KES" implies. Copper for cash-out-of-pocket (buy),
            sage for money-coming-back (sell) — the same semantic pair the
            rest of the app already uses for spend vs. settle. */}
        <nav className="tdr-act" aria-label="Trade">
          <Link to="/trade?tab=buy" className="tdr-act-card tdr-act-buy">
            <span className="tdr-act-icon">
              <Icon name="arrowUp" size={17} strokeWidth={2.2} />
            </span>
            <span className="tdr-act-text">
              <strong>Buy crypto</strong>
              <span>Pay with M-Pesa, receive WLD or USDC</span>
            </span>
            <span className="tdr-act-go" aria-hidden="true">
              <Icon name="arrowRight" size={15} strokeWidth={2.2} />
            </span>
          </Link>
          <Link to="/trade?tab=sell" className="tdr-act-card tdr-act-sell">
            <span className="tdr-act-icon">
              <Icon name="arrowDown" size={17} strokeWidth={2.2} />
            </span>
            <span className="tdr-act-text">
              <strong>Sell crypto</strong>
              <span>Send WLD or USDC, cash out to M-Pesa</span>
            </span>
            <span className="tdr-act-go" aria-hidden="true">
              <Icon name="arrowRight" size={15} strokeWidth={2.2} />
            </span>
          </Link>
        </nav>
        <div className="tdr-home-util-row" style={{ marginTop: 14 }}>
          <Link to="/wallet#receive" className="tdr-home-util-link">Receive</Link>
          <Link to="/orders" className="tdr-home-util-link">History</Link>
        </div>
      </div>

      <aside className="tcash-desk-note">
        <strong>A local desk, with a record of every trade.</strong>
        <p>Kenya · M-Pesa settlement · Operator reviewed</p>
        <Link to="/support">How settlement works →</Link>
      </aside>

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
          <p className="tdr-home-empty">{historyError || "No orders yet. Buy or sell to start your history."}</p>
        )}
      </section>

      {/* ── invite — one quiet line, not a competing card ────────── */}
      <div className="tdr-home-invite">
        <span className="tdr-home-invite-copy">
          Know someone who uses M-Pesa?
        </span>
        {shareMessage
          ? <span className="tdr-home-invite-copy" style={{ color: "var(--success)" }}>{shareMessage}</span>
          : <button type="button" className="tdr-home-invite-action" onClick={handleShare}>Share</button>}
      </div>

    </div>
  );
}
