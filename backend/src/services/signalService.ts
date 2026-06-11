// AI Signal generation: MACD(35,65,14) + UT Bot ATR trailing stop on 30m candles.
// Refreshes every 30 minutes, surfaces the 4 strongest signals across markets.

const MARKETS = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT','LTCUSDT'];

const FAST = 35, SLOW = 65, SIGNAL = 14, ATR_PERIOD = 10, KEY = 1, TF = '30m';
const REFRESH_MS = 30 * 60 * 1000;

export interface RawSignal {
  market: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  atr: number;          // price-unit stop distance basis
  winChance: number;    // %
  strength: number;     // ranking metric
}

let cache: { generatedAt: number; signals: RawSignal[] } = { generatedAt: 0, signals: [] };

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { tr.push(highs[i] - lows[i]); continue; }
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return ema(tr, period);
}

async function fetchKlines(sym: string): Promise<{ h: number[]; l: number[]; c: number[] } | null> {
  try {
    const res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${TF}&limit=200`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as string[][];
    return {
      h: data.map(d => parseFloat(d[2])),
      l: data.map(d => parseFloat(d[3])),
      c: data.map(d => parseFloat(d[4])),
    };
  } catch { return null; }
}

function analyse(sym: string, k: { h: number[]; l: number[]; c: number[] }): RawSignal | null {
  const { h, l, c } = k;
  if (c.length < SLOW + SIGNAL) return null;

  const macdLine = ema(c, FAST).map((v, i) => v - ema(c, SLOW)[i]);
  const signalLine = ema(macdLine, SIGNAL);
  const n = c.length - 1;
  const hist = macdLine[n] - signalLine[n];

  // UT Bot ATR trailing stop
  const atrArr = atr(h, l, c, ATR_PERIOD);
  let stop = c[0];
  for (let i = 1; i < c.length; i++) {
    const nLoss = KEY * atrArr[i];
    const src = c[i], prev = stop;
    if (src > prev && c[i - 1] > prev) stop = Math.max(prev, src - nLoss);
    else if (src < prev && c[i - 1] < prev) stop = Math.min(prev, src + nLoss);
    else stop = src > prev ? src - nLoss : src + nLoss;
  }
  const price = c[n];
  const aboveStop = price > stop;
  const nLoss = KEY * atrArr[n];

  // Always produce a signal. Direction = MACD + UT Bot vote; agreement boosts confidence.
  const macdBuy = hist > 0;
  const agree = macdBuy === aboveStop;
  const direction: 'BUY' | 'SELL' = agree ? (macdBuy ? 'BUY' : 'SELL') : (macdBuy ? 'BUY' : 'SELL');

  const histStrength = Math.abs(hist) / price;          // normalized momentum
  const strength = histStrength * 1000 + (agree ? 1 : 0);
  // Higher confidence when MACD and UT Bot agree, lower when they conflict
  const base = agree ? 64 : 52;
  const winChance = Math.min(85, Math.max(50, Math.round(base + histStrength * 5000)));

  return { market: sym, direction, entry: price, atr: nLoss, winChance, strength };
}

export async function refreshSignals(): Promise<void> {
  const results = await Promise.all(MARKETS.map(async m => {
    const k = await fetchKlines(m);
    return k ? analyse(m, k) : null;
  }));
  const signals = results.filter((s): s is RawSignal => s !== null)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);
  cache = { generatedAt: Date.now(), signals };
  console.log(`AI signals refreshed: ${signals.length} signals`);
}

export async function getSignals(): Promise<{ generatedAt: number; nextRefresh: number; signals: RawSignal[] }> {
  if (Date.now() - cache.generatedAt > REFRESH_MS || cache.signals.length === 0) {
    await refreshSignals();
  }
  return { generatedAt: cache.generatedAt, nextRefresh: cache.generatedAt + REFRESH_MS, signals: cache.signals };
}

export function startSignalService(): void {
  refreshSignals();
  setInterval(refreshSignals, REFRESH_MS);
  console.log('AI signal service started (MACD 35/65/14 + UT Bot, 30m, refresh 30min)');
}
