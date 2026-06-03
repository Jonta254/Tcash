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
    <div className="stack page-enter">
      <section className="panel stack trade-desk-shell">
        <div className="trade-desk-head">
          <div className="trade-desk-copy">
            <span className="brand-kicker">Trade desk</span>
            <h2>Buy or sell WLD and USDC</h2>
          </div>
          <Link to="/orders" className="button-secondary">
            Orders
          </Link>
        </div>

        <div className="trade-toggle trade-toggle-premium">
          <button
            type="button"
            className={`trade-toggle-button trade-toggle-button-buy${activeTab === "buy" ? " active" : ""}`}
            onClick={() => switchTab("buy")}
          >
            <span className="trade-toggle-label">Buy</span>
            <small>Pay KES</small>
          </button>
          <button
            type="button"
            className={`trade-toggle-button trade-toggle-button-sell${activeTab === "sell" ? " active" : ""}`}
            onClick={() => switchTab("sell")}
          >
            <span className="trade-toggle-label">Sell</span>
            <small>Receive KES</small>
          </button>
        </div>
      </section>

      {activeTab === "buy" ? <BuyPage /> : <SellPage />}
    </div>
  );
}

export default TradePage;
