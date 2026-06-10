import { useState, useEffect, useRef } from 'react';

export interface TickerData {
  symbol: string;
  price: number;
  prevPrice: number;
  changePercent: number;
  high: number;
  low: number;
}

const CRYPTO_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','MATICUSDT','LINKUSDT',
  'DOTUSDT','LTCUSDT','UNIUSDT','AAVEUSDT',
];

const STREAMS = CRYPTO_SYMBOLS.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
const WS_URL = `wss://stream.binance.com:9443/stream?streams=${STREAMS}`;

export function useBinanceStream() {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data as string) as { data?: { s: string; c: string; o: string; h: string; l: string } };
        const d = msg.data;
        if (!d?.s) return;
        const newPrice = parseFloat(d.c);
        setTickers(prev => ({
          ...prev,
          [d.s]: {
            symbol: d.s,
            price: newPrice,
            prevPrice: prev[d.s]?.price ?? newPrice,
            changePercent: ((parseFloat(d.c) - parseFloat(d.o)) / parseFloat(d.o)) * 100,
            high: parseFloat(d.h),
            low: parseFloat(d.l),
          },
        }));
      };

      ws.onclose = () => {
        if (active) timerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return tickers;
}

export { CRYPTO_SYMBOLS };
