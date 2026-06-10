import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../constants';

export interface PriceData {
  price: number;
  timestamp: number;
  source: string;
  age: number;
  change24h?: number;
}

export function usePrice(symbol: string) {
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const prevSymbol = useRef('');

  useEffect(() => {
    if (!symbol) return;
    if (prevSymbol.current !== symbol) {
      setData(null);
      setLoading(true);
      prevSymbol.current = symbol;
    }

    let active = true;
    const fetchPrice = async () => {
      try {
        const res = await fetch(`${API_BASE}/prices/${encodeURIComponent(symbol)}`);
        if (res.ok && active) {
          const d = await res.json() as PriceData;
          setData(d);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [symbol]);

  return { price: data?.price ?? null, data, loading };
}

export function useAllPrices() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      try {
        const res = await fetch(`${API_BASE}/prices`);
        if (res.ok && active) setPrices(await res.json());
      } catch { /* ignore */ }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 1500);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return prices;
}
