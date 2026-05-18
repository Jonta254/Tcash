const FALLBACK_WORLD_APP_ID = "app_02bd6decc052fc1dfa29487444f6c6f";
const RESOLVED_WORLD_APP_ID =
  (import.meta.env.VITE_WORLD_APP_ID || "").trim() || FALLBACK_WORLD_APP_ID;

export const APP_CONFIG = {
  appName: "TMpesa",
  repoName: "WorldTMpesa",
  worldAppId: RESOLVED_WORLD_APP_ID,
  firstAccessVerificationAction: "first-access-check",
  highValueOrderAction: "high-value-order-check",
  highValueOrderKesThreshold: 10000,
  defaultSettings: {
    ratesKes: {
      WLD: 120,
      USDC: 128,
    },
    sellWalletAddress: "0x0f029f35a9da4043ff84b2c98a023d0a68eb64b4",
    mpesaPaybillNumber: "5698981",
    mpesaTillName: "TMpesa Exchange",
    supportEmail: "brianokindo@gmail.com",
    whatsappSupportLink: "https://wa.me/qr/WLKPNPNVKPZEM1",
    worldAppId: RESOLVED_WORLD_APP_ID,
  },
  supportedAssets: ["WLD", "USDC"],
  worldPaySupportedAssets: ["WLD", "USDC"],
};

export const STORAGE_KEYS = {
  users: "worldtmpesa_users",
  currentUser: "worldtmpesa_current_user",
  orders: "worldtmpesa_orders",
  settings: "worldtmpesa_settings",
};
