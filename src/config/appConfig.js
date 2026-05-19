const FALLBACK_WORLD_APP_ID = "app_02bd6decc052fc1dfa29487444f6c6f";
const RESOLVED_WORLD_APP_ID =
  (import.meta.env.VITE_WORLD_APP_ID || "").trim() || FALLBACK_WORLD_APP_ID;

export const APP_CONFIG = {
  appName: "TMpesa",
  repoName: "WorldTMpesa",
  worldAppId: RESOLVED_WORLD_APP_ID,
  worldChain: {
    rpcUrl: "https://worldchain-mainnet.g.alchemy.com/public",
    chainId: 480,
    assets: {
      WLD: {
        symbol: "WLD",
        name: "Worldcoin",
        address: "0x2cfc85d8e48f8eab294be644d9e25c3030863003",
        decimals: 18,
      },
      USDC: {
        symbol: "USDC",
        name: "Digital Dollars",
        address: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
        decimals: 6,
      },
    },
  },
  firstAccessVerificationAction: "first-access-check",
  highValueOrderAction: "high-value-order-check",
  highValueOrderKesThreshold: 10000,
  defaultSettings: {
    ratesKes: {
      WLD: 120,
      USDC: 128,
    },
    sellWalletAddress: "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc",
    mpesaPaybillNumber: "5698981",
    mpesaTillName: "TMpesa Exchange",
    supportEmail: "brianokindo2022@gmail.com",
    whatsappSupportLink: "https://wa.me/qr/WLKPNPNVKPZEM1",
    worldAppId: RESOLVED_WORLD_APP_ID,
    referralRewardKes: 30,
    referralMilestones: [
      { users: 6, rewardKes: 100 },
      { users: 10, rewardKes: 150 },
    ],
  },
  supportedAssets: ["WLD", "USDC"],
  worldPaySupportedAssets: ["WLD", "USDC"],
};

export const STORAGE_KEYS = {
  users: "worldtmpesa_users",
  currentUser: "worldtmpesa_current_user",
  orders: "worldtmpesa_orders",
  settings: "worldtmpesa_settings",
  referralStats: "worldtmpesa_referral_stats",
  appTheme: "worldtmpesa_theme",
  ratings: "worldtmpesa_ratings",
};
