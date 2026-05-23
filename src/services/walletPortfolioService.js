import { APP_CONFIG } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";

const WALLET_PORTFOLIO_CACHE_KEY = "worldtmpesa_wallet_portfolio_cache";
const WALLET_READ_TIMEOUT_MS = 5000;

function trimHexPrefix(value) {
  return String(value || "").replace(/^0x/i, "");
}

function hexToBigInt(hexValue) {
  const normalized = trimHexPrefix(hexValue);
  return normalized ? BigInt(`0x${normalized}`) : 0n;
}

function formatTokenBalance(rawBalance, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = rawBalance / divisor;
  const fraction = rawBalance % divisor;
  const paddedFraction = fraction.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");

  return paddedFraction ? `${whole.toString()}.${paddedFraction}` : whole.toString();
}

async function readContract({ to, data }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), WALLET_READ_TIMEOUT_MS)
    : null;

  const response = await fetch(APP_CONFIG.worldChain.rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to,
          data,
        },
        "latest",
      ],
    }),
    signal: controller?.signal,
  })
    .catch((error) => {
      if (error?.name === "AbortError") {
        throw new Error("TMpesa could not refresh your wallet balance right now.");
      }

      throw new Error("Unable to reach the live World wallet reader right now.");
    })
    .finally(() => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    });

  const payload = await response.json();

  if (payload?.error) {
    throw new Error(payload.error.message || "Unable to read wallet balances.");
  }

  return payload.result || "0x0";
}

function normalizeWalletAddress(walletAddress) {
  return String(walletAddress || "").trim().toLowerCase();
}

export function getCachedWorldWalletPortfolio(walletAddress) {
  const normalizedWallet = normalizeWalletAddress(walletAddress);

  if (!normalizedWallet) {
    return {
      walletAddress: "",
      assets: [],
      supported: false,
    };
  }

  const cache = readStorage(WALLET_PORTFOLIO_CACHE_KEY, {});
  const cached = cache?.[normalizedWallet];

  if (!cached || !Array.isArray(cached.assets)) {
    return {
      walletAddress: normalizedWallet,
      assets: [],
      supported: true,
    };
  }

  return cached;
}

export function cacheWorldWalletPortfolio(portfolio) {
  const normalizedWallet = normalizeWalletAddress(portfolio?.walletAddress);

  if (!normalizedWallet) {
    return;
  }

  const cache = readStorage(WALLET_PORTFOLIO_CACHE_KEY, {});
  const nextCache = {
    ...cache,
    [normalizedWallet]: {
      ...portfolio,
      walletAddress: portfolio.walletAddress,
      cachedAt: new Date().toISOString(),
    },
  };
  writeStorage(WALLET_PORTFOLIO_CACHE_KEY, nextCache);
}

export async function getWorldWalletPortfolio(walletAddress) {
  const normalizedWallet = String(walletAddress || "").trim();

  if (!normalizedWallet) {
    return {
      walletAddress: "",
      assets: [],
      supported: false,
    };
  }

  const paddedWallet = trimHexPrefix(normalizedWallet).padStart(64, "0");
  const balanceOfSelector = "0x70a08231";

  const assets = await Promise.all(
    Object.values(APP_CONFIG.worldChain.assets).map(async (asset) => {
      const rawBalanceHex = await readContract({
        to: asset.address,
        data: `${balanceOfSelector}${paddedWallet}`,
      });
      const rawBalance = hexToBigInt(rawBalanceHex);

      return {
        symbol: asset.symbol,
        name: asset.name,
        rawBalance: rawBalance.toString(),
        formattedBalance: formatTokenBalance(rawBalance, asset.decimals),
      };
    }),
  );

  const portfolio = {
    walletAddress: normalizedWallet,
    assets,
    supported: true,
  };

  cacheWorldWalletPortfolio(portfolio);
  return portfolio;
}
