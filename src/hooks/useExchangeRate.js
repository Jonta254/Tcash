import { useEffect, useState } from "react";
import {
  fetchWorldMarketRates,
  getExchangeRate,
  getExchangeRates,
  subscribeToRateUpdates,
} from "../services";

export function useExchangeRate(asset = "WLD") {
  const [exchangeRates, setExchangeRates] = useState(getExchangeRates());

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
          setExchangeRates(getExchangeRates());
        }
      }
    };

    syncLiveRates();
    const interval = window.setInterval(syncLiveRates, 30000);
    const unsubscribe = subscribeToRateUpdates(() => {
      if (active) {
        setExchangeRates(getExchangeRates());
      }
      syncLiveRates();
    });

    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [asset]);

  return exchangeRates[asset] || getExchangeRate(asset);
}

export function useExchangeRates() {
  const [exchangeRates, setExchangeRates] = useState(getExchangeRates());

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
          setExchangeRates(getExchangeRates());
        }
      }
    };

    syncLiveRates();
    const interval = window.setInterval(syncLiveRates, 30000);
    const unsubscribe = subscribeToRateUpdates(() => {
      if (active) {
        setExchangeRates(getExchangeRates());
      }
      syncLiveRates();
    });

    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return exchangeRates;
}
