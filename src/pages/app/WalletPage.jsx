import { useCallback, useEffect, useMemo, useState } from "react";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import { getCachedWorldWalletPortfolio, formatKES, getCurrentUser, getWorldWalletPortfolio } from "../../services";

export default function WalletPage() {
  const user = getCurrentUser();
  const rates = useExchangeRates();
  const [portfolio, setPortfolio] = useState(() => getCachedWorldWalletPortfolio(user?.walletAddress));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const refresh = useCallback(async () => {
    if (!user?.walletAddress) return;
    setLoading(true); setError("");
    try { setPortfolio(await getWorldWalletPortfolio(user.walletAddress)); }
    catch { setError("Balances could not refresh. Any balances below are saved from your last visit."); }
    finally { setLoading(false); }
  }, [user?.walletAddress]);
  useEffect(() => { void refresh(); }, [refresh]);
  const hasRates = portfolio.assets.length > 0 && portfolio.assets.every(a => Number(rates[a.symbol]) > 0);
  const value = useMemo(() => portfolio.assets.reduce((sum,a) => sum + Number(a.formattedBalance || 0) * Number(rates[a.symbol] || 0),0), [portfolio.assets,rates]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(user.walletAddress); setCopyMessage("Address copied."); }
    catch { setCopyMessage("Copy failed. Long-press the full address below to copy it."); }
  };
  return (
    <div className="tdr-home page-enter">
      <h1 className="tcash-page-title">Your World wallet</h1>
      <div>
        <p className="tdr-home-greeting">Estimated value in Kenyan shillings</p>
        <div className="tdr-home-balance-row"><strong className="tdr-home-balance-num">{hasRates ? formatKES(value) : "KES —"}</strong></div>
        <p className="muted">Your crypto stays in World App until you approve a payment. This estimate is not a cash balance.</p>
        <button type="button" className="button-ghost" disabled={loading} onClick={refresh}>{loading ? "Refreshing balances…" : "Refresh balances"}</button>
        {error && <p className="tdr-login-error" role="status">{error}</p>}
      </div>
      <section className="tdr-home-section">
        <h2 className="tcash-section-title">Holdings</h2>
        {portfolio.assets.length ? <div className="tdr-ledger-list">{portfolio.assets.map(a => <div className="tdr-ledger-row" key={a.symbol}><div className="tdr-ledger-mid"><strong>{a.symbol}</strong><span className="muted">{Number(rates[a.symbol]) > 0 ? `1 ${a.symbol} ≈ ${formatKES(rates[a.symbol])}` : "Market rate unavailable"}</span></div><strong>{a.formattedBalance} {a.symbol}</strong></div>)}</div> : <p className="muted">{loading ? "Reading your World wallet…" : "Balances are unavailable. Refresh to try again."}</p>}
      </section>
      <section id="receive" className="tdr-wallet-vault">
        <h2 className="tcash-section-title">Receive WLD or USDC</h2>
        <strong>{user?.username ? `@${user.username}` : "Your World wallet"}</strong>
        <p className="muted">Use World Chain only. Sending on another network can result in lost funds.</p>
        <code className="tcash-wallet-address">{user?.walletAddress}</code>
        {copyMessage && <p className="notice" role="status">{copyMessage}</p>}
        <button type="button" className="button-secondary" onClick={copy} disabled={!user?.walletAddress}>Copy receiving address</button>
      </section>
    </div>
  );
}
