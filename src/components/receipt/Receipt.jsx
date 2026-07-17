import { Link } from "react-router-dom";
import Icon from "../icons/Icon";
import { shareMiniAppInvite, tenderHaptics } from "../../services";

/*
 * The settlement receipt — what a completed trade issues instead of a
 * generic success modal. Physically a ticket: a stamp landing, a hero
 * figure (the same size ladder as the balance and a live quote — this
 * is the "recorded historical figure" tier, per DESIGN_SYSTEM §1), a
 * perforation, and a reference slip. Shared by Buy and Sell so the
 * artifact a user gets here and the ledger row they see in History
 * later are visibly the same object, not two different ideas.
 */
function Receipt({ title, leadCopy, amountLabel, amountValue, lines, reference, shareText, onNewTrade }) {
  const handleShare = async () => {
    tenderHaptics.tap();
    try {
      await shareMiniAppInvite({ title: "Tcash receipt", text: shareText, url: "" });
    } catch {
      // sharing is a convenience, not a requirement — fail silently
    }
  };

  return (
    <div className="tdr-receipt">
      <div className="tdr-receipt-head">
        <span className="tdr-receipt-mark">Tcash</span>
        <span className="tdr-receipt-kicker">Settlement receipt</span>
      </div>

      <div className="tdr-receipt-stamp" aria-hidden="true">
        <Icon name="check" size={34} strokeWidth={1.7} />
      </div>

      <h2 className="tdr-receipt-title">{title}</h2>
      {leadCopy ? <p className="tdr-receipt-lead">{leadCopy}</p> : null}

      <div className="tdr-receipt-amount">
        <span className="tdr-receipt-amount-label">{amountLabel}</span>
        <strong className="tdr-receipt-amount-fig">{amountValue}</strong>
      </div>

      <div className="tdr-receipt-perforation" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="tdr-receipt-lines">
        {lines.map((line) => (
          <div key={line.label} className="tdr-receipt-line">
            <span>{line.label}</span>
            <strong>{line.value}</strong>
          </div>
        ))}
      </div>

      {reference ? <div className="tdr-receipt-ref">REF · {reference}</div> : null}

      <div className="tdr-receipt-actions">
        <button type="button" className="button-secondary" onClick={handleShare}>
          Share receipt
        </button>
        <Link to="/orders" className="button">
          View in History
        </Link>
        <button type="button" className="button-ghost" onClick={onNewTrade}>
          New trade
        </button>
      </div>
    </div>
  );
}

export default Receipt;
