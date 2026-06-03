import { useEffect, useMemo, useState } from "react";
import {
  getCachedWorldWalletPortfolio,
  formatKES,
  formatWorldLaunchSource,
  getCurrentUser,
  getWorldAppContext,
  getWorldWalletPortfolio,
} from "../../services";
import { useExchangeRates } from "../../hooks/useExchangeRate";

function truncateAddress(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletPage() {
  const user = getCurrentUser();
  const worldApp = getWorldAppContext();
  const exchangeRates = useExchangeRates();
  const initialPortfolio = getCachedWorldWalletPortfolio(user?.walletAddress);
  const [walletPortfolio, setWalletPortfolio] = useState(initialPortfolio);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    if (!user?.walletAddress) {
      return;
    }

    let active = true;
    setWalletLoading(true);
    setWalletError("");

    getWorldWalletPortfolio(user.walletAddress)
      .then((portfolio) => {
        if (active) {
          setWalletPortfolio(portfolio);
        }
      })
      .catch((error) => {
        if (active) {
          const cachedPortfolio = getCachedWorldWalletPortfolio(user.walletAddress);

          if (cachedPortfolio.assets.length) {
            setWalletPortfolio(cachedPortfolio);
            setWalletError("");
          } else {
            setWalletPortfolio({
              walletAddress: user.walletAddress,
              assets: [],
              supported: true,
            });
            setWalletError("");
          }
        }
      })
      .finally(() => {
        if (active) {
          setWalletLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.walletAddress]);

  const totalKes = useMemo(
    () =>
      walletPortfolio.assets.reduce((sum, assetEntry) => {
        const marketRate = exchangeRates[assetEntry.symbol] || 0;
        return sum + Number(assetEntry.formattedBalance || 0) * marketRate;
      }, 0),
    [exchangeRates, walletPortfolio.assets],
  );

  const handleCopyAddress = async () => {
    if (!user?.walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopyMessage("Wallet address copied.");
      window.setTimeout(() => setCopyMessage(""), 1800);
    } catch {
      setCopyMessage("Copy failed. Press and hold the address to copy it.");
    }
  };

  return (
    <div className="stack">
      <section className="panel profile-hero">
        <div className="profile-hero-head">
          <div>
            <span className="brand-kicker">Wallet</span>
            <h2>Wallet</h2>
            <p className="muted">Live balances and receive address.</p>
          </div>
          <span className="live-badge">{user?.walletAddress ? "Connected" : "Not connected"}</span>
        </div>
        <div className="profile-summary-grid">
          <div className="profile-summary-card">
            <span>World username</span>
            <strong>{user?.username ? `@${user.username}` : "Unavailable"}</strong>
          </div>
          <div className="profile-summary-card">
            <span>Wallet auth</span>
            <strong>{user?.authMethod === "world-app" ? "Connected" : "Not connected"}</strong>
          </div>
          <div className="profile-summary-card">
            <span>KES equivalent</span>
            <strong>{totalKes > 0 ? formatKES(totalKes) : "KES 0.00"}</strong>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Balances</span>
            <h3>Asset balances</h3>
          </div>
          <span className="market-panel-note">Live World wallet read</span>
        </div>
        {walletError ? <div className="error">{walletError}</div> : null}
        {walletLoading ? <div className="notice">Loading wallet balances...</div> : null}
        {!user?.walletAddress ? (
          <div className="notice">Connect your World wallet to view live balances.</div>
        ) : (
          <div className="wallet-asset-grid">
            {walletPortfolio.assets.map((asset) => (
              <div key={asset.symbol} className="wallet-asset-card">
                <span>{asset.name}</span>
                <strong>{asset.formattedBalance}</strong>
                <small>{asset.symbol}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="receive" className="panel stack">
        <div>
          <span className="brand-kicker">Receive and deposit</span>
          <h3>Receive address</h3>
          <p className="muted">Receive WLD or USDC using your connected World wallet address.</p>
        </div>
        <div className="info-box">
          <strong>Wallet address</strong>
          <code style={{ wordBreak: "break-all", fontSize: "0.82em" }}>
            {user?.walletAddress ? truncateAddress(user.walletAddress) : "Connect your World wallet first."}
          </code>
          {user?.walletAddress ? (
            <small className="muted" style={{ fontSize: "0.75em", marginTop: 2 }}>
              {user.walletAddress}
            </small>
          ) : null}
        </div>
        <div className="soft-note">Only send WLD or USDC on World Chain to this address.</div>
        {copyMessage ? <div className="notice">{copyMessage}</div> : null}
        <div className="button-row compact-actions">
          <button type="button" className="button" onClick={handleCopyAddress} disabled={!user?.walletAddress}>
            Copy full address
          </button>
        </div>
      </section>

      <section className="panel stack">
        <span className="brand-kicker">Wallet status</span>
        <div className="profile-stats-list">
          <div className="profile-stat-row">
            <span>World identity</span>
            <strong>{user?.username ? "Available" : "Unavailable"}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Mini app access</span>
            <strong>{user?.authMethod === "world-app" ? "Ready" : "Local session"}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Launch source</span>
            <strong>{formatWorldLaunchSource(worldApp.location)}</strong>
          </div>
          <div className="profile-stat-row">
            <span>Live wallet read</span>
            <strong>{user?.walletAddress ? "Enabled" : "Unavailable"}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default WalletPage;
