import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BuyPage from "./BuyPage";
import SellPage from "./SellPage";

function TradePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => {
    const requested = (searchParams.get("tab") || "buy").toLowerCase();
    return requested === "sell" ? "sell" : "buy";
  }, [searchParams]);

  const switchTab = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Trade</span>
            <h2>Buy or sell WLD and USDC</h2>
            <p className="muted">
              Use one focused trading desk for both directions. Switch between buying and selling
              without leaving the wallet flow.
            </p>
          </div>
          <Link to="/orders" className="button-secondary">
            Orders
          </Link>
        </div>
        <div className="trade-toggle">
          <button
            type="button"
            className={`trade-toggle-button${activeTab === "buy" ? " active" : ""}`}
            onClick={() => switchTab("buy")}
          >
            Buy Crypto
          </button>
          <button
            type="button"
            className={`trade-toggle-button${activeTab === "sell" ? " active" : ""}`}
            onClick={() => switchTab("sell")}
          >
            Sell Crypto
          </button>
        </div>
      </section>

      {activeTab === "buy" ? <BuyPage /> : <SellPage />}
    </div>
  );
}

export default TradePage;
