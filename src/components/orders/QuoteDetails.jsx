import { formatCryptoAmount, formatKES } from "../../services/pricingService";
export default function QuoteDetails({ type, asset, amount, gross, fee, total, rate }) {
  return (
    <section className="trade-summary-box trade-summary-compact" aria-label="Quote breakdown">
      <div className="tsb-row"><span>Market value</span><strong>{formatKES(gross)}</strong></div>
      <div className="tsb-row"><span>Tcash fee</span><strong>{formatKES(fee)}</strong></div>
      <div className="tsb-row tsb-row-receive"><span>{type === "buy" ? "You pay" : "M-Pesa payout"}</span><strong>{formatKES(total)}</strong></div>
      <div className="tsb-row"><span>{type === "buy" ? "You receive" : "You send"}</span><strong>{formatCryptoAmount(amount, 6)} {asset}</strong></div>
      <p className="tsb-note">1 {asset} = {formatKES(rate)} before fees. M-Pesa may charge separately. An operator reviews each payment before settlement.</p>
    </section>
  );
}
