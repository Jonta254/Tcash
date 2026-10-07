import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { tenderHaptics } from "../../services";
import BuyPage from "./BuyPage";
import SellPage from "./SellPage";

function TradePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => {
    const requested = (searchParams.get("tab") || "buy").toLowerCase();
    return requested === "sell" ? "sell" : "buy";
  }, [searchParams]);

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    tenderHaptics.select();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    nextParams.delete("order");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="stack page-enter trade-page-compact">
      <h1 className="sr-only">Trade — buy or sell WLD and USDC</h1>

      <nav className="tdr-trade-split" aria-label="Trade direction">
        <button
          type="button"
          className={`tdr-trade-half${activeTab === "buy" ? " active" : ""}`}
          aria-pressed={activeTab === "buy"}
          onClick={() => switchTab("buy")}
        >
          <span className="tdr-trade-half-label">Buy</span>
          <span className="tdr-trade-half-sub">Pay KES</span>
        </button>
        <button
          type="button"
          className={`tdr-trade-half${activeTab === "sell" ? " active" : ""}`}
          aria-pressed={activeTab === "sell"}
          onClick={() => switchTab("sell")}
        >
          <span className="tdr-trade-half-label">Sell</span>
          <span className="tdr-trade-half-sub">Receive KES</span>
        </button>
      </nav>

      {activeTab === "buy" ? <BuyPage key={searchParams.get("order") || "new-buy"} /> : <SellPage key={searchParams.get("order") || "new-sell"} />}
    </div>
  );
}

export default TradePage;
