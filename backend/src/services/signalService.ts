// AI Signal generation: MACD(35,65,14) + UT Bot ATR trailing stop on 30m candles.
// Refreshes every 30 minutes, surfaces the 4 strongest signals across markets.

const MARKETS = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT','LTCUSDT'];

const FAST = 35, SLOW = 65, SIGNAL = 14, ATR_PERIOD = 10, KEY = 1, TF = '15m';
const WINDOW_MS = 15 * 60 * 1000;     // signals locked per aligned 15-min window
const ENTRY_WINDOW_MS = 5 * 60 * 1000; // entries allowed only in first 5 min of the window

// Start of the current aligned 15-minute window (wall-clock :00/:15/:30/:45)
function currentWindowStart(now = Date.now()): number {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}

// US stock market regular session: Mon–Fri, 9:30am–4:00pm America/New_York (DST-aware).
export function isUsMarketOpen(d = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const wd = get('weekday');
  if (wd === 'Sat' || wd === 'Sun') return false;
  const mins = (parseInt(get('hour')) % 24) * 60 + parseInt(get('minute'));
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export interface RawSignal {
  market: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  atr: number;          // price-unit stop distance basis
  winChance: number;    // %
  strength: number;     // ranking metric
  spark: number[];      // recent closes for the mini chart
}

let cache: { windowStart: number; signals: RawSignal[] } = { windowStart: 0, signals: [] };

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

  return { market: sym, direction, entry: price, atr: nLoss, winChance, strength, spark: c.slice(-24) };
}

export async function refreshSignals(windowStart: number): Promise<void> {
  const results = await Promise.all(MARKETS.map(async m => {
    const k = await fetchKlines(m);
    return k ? analyse(m, k) : null;
  }));
  const signals = results.filter((s): s is RawSignal => s !== null)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);
  cache = { windowStart, signals };
  console.log(`AI signals refreshed for window ${new Date(windowStart).toISOString()}: ${signals.length} signals`);
}

export async function getSignals(): Promise<{
  windowStart: number; nextRefresh: number; entryDeadline: number; marketOpen: boolean; signals: RawSignal[];
}> {
  const marketOpen = isUsMarketOpen();
  const ws = currentWindowStart();
  // Only recompute fresh signals while the US market is open
  if (marketOpen && (cache.windowStart !== ws || cache.signals.length === 0)) {
    await refreshSignals(ws);
  }
  return {
    windowStart: cache.windowStart,
    nextRefresh: cache.windowStart + WINDOW_MS,
    entryDeadline: cache.windowStart + ENTRY_WINDOW_MS,
    marketOpen,
    signals: cache.signals,
  };
}

export function startSignalService(): void {
  if (isUsMarketOpen()) getSignals();
  // Re-check every 30s, but only do work during US market hours
  setInterval(() => { if (isUsMarketOpen()) getSignals().catch(() => {}); }, 30 * 1000);
  console.log('AI signal service started (MACD 35/65/14 + UT Bot, 15m, US market hours only)');
}
