import { useEffect, useState } from "react";
import {
  fetchWorldMarketRates,
  getLastLiveMarketRates,
  subscribeToRateUpdates,
} from "../services";

const LIVE_RATE_REFRESH_MS = 15000;

function useLiveRateState() {
  const [exchangeRates, setExchangeRates] = useState(() => getLastLiveMarketRates() || {});

  useEffect(() => {
    let active = true;

    const syncLiveRates = async () => {
      try {
        const liveMarket = await fetchWorldMarketRates();

        if (active) {
          setExchangeRates((current) => ({
            ...current,
            ...liveMarket.rates,
          }));
        }
      } catch {
        if (active) {
          setExchangeRates((current) => {
            const lastLiveRates = getLastLiveMarketRates();

            if (lastLiveRates) {
              return {
                ...current,
                ...lastLiveRates,
              };
            }

            return current;
          });
        }
      }
    };

    const handleForegroundSync = () => {
      if (document.visibilityState === "visible") {
        syncLiveRates();
      }
    };

    syncLiveRates();
    const interval = window.setInterval(syncLiveRates, LIVE_RATE_REFRESH_MS);
    const unsubscribe = subscribeToRateUpdates(() => {
      if (active) {
        setExchangeRates(getExchangeRates());
      }
      syncLiveRates();
    });

    window.addEventListener("focus", syncLiveRates);
    window.addEventListener("online", syncLiveRates);
    document.addEventListener("visibilitychange", handleForegroundSync);

    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
      window.removeEventListener("focus", syncLiveRates);
      window.removeEventListener("online", syncLiveRates);
      document.removeEventListener("visibilitychange", handleForegroundSync);
    };
  }, []);

  return exchangeRates;
}

export function useExchangeRate(asset = "WLD") {
  const exchangeRates = useLiveRateState();
  const lastLiveRates = getLastLiveMarketRates();
  return exchangeRates[asset] || lastLiveRates?.[asset] || 0;
}

export function useExchangeRates() {
  return useLiveRateState();
}
