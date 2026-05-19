import { APP_CONFIG } from "../config/appConfig";

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
  });

  const payload = await response.json();

  if (payload?.error) {
    throw new Error(payload.error.message || "Unable to read wallet balances.");
  }

  return payload.result || "0x0";
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

  return {
    walletAddress: normalizedWallet,
    assets,
    supported: true,
  };
}
