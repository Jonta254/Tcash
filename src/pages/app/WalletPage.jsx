import { useEffect, useMemo, useState } from "react";
import {
  getCachedWorldWalletPortfolio,
  formatKES,
  formatWorldLaunchSource,
  getCurrentUser,
  getWorldAppContext,
  getWorldWalletPortfolio,
  haptic,
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
    if (!user?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(user.walletAddress);
      haptic("light");
      setCopyMessage("Wallet address copied.");
      window.setTimeout(() => setCopyMessage(""), 1800);
    } catch {
      setCopyMessage("Copy failed. Press and hold the address to copy it.");
    }
  };

  const assetIconLabel = { WLD: "W", USDC: "$" };

  return (
    <div className="stack page-enter wallet-page-compact">
      <h1 className="sr-only">Wallet — balances and receive address</h1>

      <section className="panel wallet-hero-compact">
        <div className="wallet-hero-top">
          <div>
            <span className="wallet-hero-label">Portfolio in KES</span>
            <strong className="wallet-hero-total">{totalKes > 0 ? formatKES(totalKes) : "KES 0.00"}</strong>
          </div>
          <span className="live-badge">{user?.walletAddress ? "Connected" : "Not connected"}</span>
        </div>

        {walletError ? <div className="error">{walletError}</div> : null}
        {walletLoading ? <div className="notice">Loading wallet balances…</div> : null}
        {!user?.walletAddress ? (
          <div className="notice">Connect your World wallet to view live balances.</div>
        ) : (
          <div className="wallet-asset-row">
            {walletPortfolio.assets.map((asset) => (
              <div key={asset.symbol} className="wallet-asset-chip">
                <span className={`wac-icon wac-icon-${asset.symbol.toLowerCase()}`} aria-hidden="true">
                  {assetIconLabel[asset.symbol] || asset.symbol[0]}
                </span>
                <div className="wac-body">
                  <span>{asset.symbol}</span>
                  <strong>{asset.formattedBalance}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="receive" className="panel wallet-receive-compact">
        <span className="brand-kicker">Receive</span>
        <div className="trade-dest-strip">
          <span className="tds-icon" aria-hidden="true">⬡</span>
          <div className="tds-text">
            <strong>
              {user?.walletAddress ? truncateAddress(user.walletAddress) : "Connect your World wallet first"}
            </strong>
            <span>{user?.username ? `@${user.username} · ` : ""}World Chain only — WLD or USDC</span>
          </div>
        </div>
        {copyMessage ? <div className="notice">{copyMessage}</div> : null}
        <button type="button" className="button" onClick={handleCopyAddress} disabled={!user?.walletAddress}>
          Copy full address
        </button>
      </section>

      <section className="panel wallet-status-compact">
        <span className="brand-kicker">Wallet status</span>
        <div className="wallet-status-line">
          <span><strong>World ID</strong>{user?.username ? "Available" : "Unavailable"}</span>
          <span><strong>Mini app</strong>{user?.authMethod === "world-app" ? "Ready" : "Local session"}</span>
          <span><strong>Source</strong>{formatWorldLaunchSource(worldApp.location)}</span>
          <span><strong>Wallet read</strong>{user?.walletAddress ? "Enabled" : "Unavailable"}</span>
        </div>
      </section>
    </div>
  );
}

export default WalletPage;
