import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { APP_CONFIG } from "../../config/appConfig";

function SafeMiniKitProvider({ children }) {
  return (
    <MiniKitProvider appId={APP_CONFIG.worldAppId}>
      {children}
    </MiniKitProvider>
  );
}

export default SafeMiniKitProvider;
