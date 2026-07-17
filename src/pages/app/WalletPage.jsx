import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/icons/Icon";
import {
  getCachedWorldWalletPortfolio,
  formatKES,
  getCurrentUser,
  getWorldWalletPortfolio,
  haptic,
} from "../../services";
import { useExchangeRates } from "../../hooks/useExchangeRate";

function truncateAddress(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const ASSET_ICON_LABEL = { WLD: "W", USDC: "$" };

/*
 * Held, not displayed: the balance sits directly on the page like Home
 * (no boxed hero card), each asset is a ledger line rather than a
 * chip, and the receive address is the one deliberate "block" this
 * screen keeps — per DESIGN_SYSTEM §3, a block is reserved for content
 * that's genuinely a bounded, actionable surface, and an address you
 * copy to receive funds is exactly that. The old "Wallet status" debug
 * panel (World ID / Mini app / Source / Wallet read) is gone — it was
 * internal state printed as if it were a feature, not a real trust
 * signal (DESIGN_SYSTEM §5 governs what trust signals TCash is allowed
 * to show, and raw state dumps aren't one of them).
 */
function WalletPage() {
  const user = getCurrentUser();
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
      .catch(() => {
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

  return (
    <div className="tdr-home page-enter">
      <h1 className="sr-only">Wallet — balances and receive address</h1>

      <div>
        <p className="tdr-home-greeting">Held in your World wallet</p>
        <div className="tdr-home-balance-row">
          <strong className="tdr-home-balance-num">
            {totalKes > 0 ? formatKES(totalKes) : "KES 0.00"}
          </strong>
        </div>
        <div className="tdr-home-balance-meta">
          <span>{user?.walletAddress ? "Connected" : "Not connected"}</span>
        </div>
        {walletError ? <p className="tdr-login-error" style={{ marginTop: 6 }}>{walletError}</p> : null}
        {walletLoading ? <p className="tdr-login-status" style={{ marginTop: 6 }}>Loading wallet balances…</p> : null}
        {!user?.walletAddress ? (
          <p className="tdr-login-status" style={{ marginTop: 6 }}>Connect your World wallet to view live balances.</p>
        ) : null}
      </div>

      {user?.walletAddress && (
        <section className="tdr-home-section">
          <div className="tdr-home-section-head">
            <span className="tdr-home-section-title">Held</span>
          </div>
          <div className="tdr-ledger-list">
            {walletPortfolio.assets.map((asset) => (
              <div key={asset.symbol} className="tdr-ledger-row">
                <span className="tdr-ledger-icon" aria-hidden="true">
                  {ASSET_ICON_LABEL[asset.symbol] || asset.symbol[0]}
                </span>
                <div className="tdr-ledger-mid">
                  <span className="tdr-ledger-title">{asset.symbol}</span>
                </div>
                <div className="tdr-ledger-right">
                  <span className="tdr-ledger-amt">{asset.formattedBalance}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="receive" className="tdr-wallet-vault">
        <span className="tdr-bridge-label">Receive</span>
        <div className="tdr-wallet-vault-row">
          <span className="tdr-wallet-vault-icon" aria-hidden="true">
            <Icon name="hexagon" size={16} strokeWidth={2} />
          </span>
          <div>
            <strong>
              {user?.walletAddress ? truncateAddress(user.walletAddress) : "Connect your World wallet first"}
            </strong>
            <span>{user?.username ? `@${user.username} · ` : ""}World Chain only — WLD or USDC</span>
          </div>
        </div>
        {copyMessage ? <p className="tdr-login-status">{copyMessage}</p> : null}
        <button type="button" className="button" onClick={handleCopyAddress} disabled={!user?.walletAddress}>
          Copy full address
        </button>
      </section>
    </div>
  );
}

export default WalletPage;
