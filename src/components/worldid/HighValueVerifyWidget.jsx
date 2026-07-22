import { IDKitRequestWidget, proofOfHuman } from "@worldcoin/idkit";
import { APP_CONFIG } from "../../config/appConfig";

/**
 * Thin wrapper over IDKit's World ID 4.0 request widget, pre-wired for the
 * Tcash high-value proof-of-human action. It only ever renders once the
 * backend has minted an RP-signed context (rp_context) — IDKit requires it,
 * and the signing key never touches the client. The parent owns open state
 * and the success/failure callbacks (see useHighValueVerification).
 */
export default function HighValueVerifyWidget({
  open,
  onOpenChange,
  rpContext,
  signal,
  onVerify,
  onVerified,
  onFail,
}) {
  if (!rpContext) {
    return null;
  }

  return (
    <IDKitRequestWidget
      open={open}
      onOpenChange={onOpenChange}
      app_id={APP_CONFIG.worldAppId}
      action={APP_CONFIG.worldIdHighValueAction}
      rp_context={rpContext}
      preset={proofOfHuman(signal ? { signal } : undefined)}
      handleVerify={onVerify}
      onSuccess={onVerified}
      onError={(code) => onFail && onFail(code)}
    />
  );
}
