// ── Price cache ────────────────────────────────────────────────────────────
interface CachedPrice {
  price: number;
  timestamp: number;
  source: string;
  change24h?: number;
}

const priceCache: Record<string, CachedPrice> = {};

// ── Symbol maps ────────────────────────────────────────────────────────────
const CRYPTO_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','MATICUSDT','LINKUSDT',
  'DOTUSDT','LTCUSDT','UNIUSDT','AAVEUSDT',
];

// Yahoo Finance symbol map (our symbol → Yahoo symbol)
const YAHOO_MAP: Record<string, string> = {
  // Forex
  'EURUSD':'EURUSD=X','GBPUSD':'GBPUSD=X','USDJPY':'USDJPY=X',
  'AUDUSD':'AUDUSD=X','USDCAD':'USDCAD=X','USDCHF':'USDCHF=X',
  'NZDUSD':'NZDUSD=X','GBPJPY':'GBPJPY=X','EURJPY':'EURJPY=X',
  'EURGBP':'EURGBP=X','CADJPY':'CADJPY=X',
  // Indices
  'NAS100':'^NDX','US30':'^DJI','SPX500':'^GSPC',
  'UK100':'^FTSE','GER40':'^GDAXI',
  // Metals
  'XAUUSD':'GC=F','XAGUSD':'SI=F',
  // Commodities
  'USOIL':'CL=F','UKOIL':'BZ=F','NATGAS':'NG=F',
  // Stocks
  'AAPL':'AAPL','TSLA':'TSLA','GOOGL':'GOOGL',
  'MSFT':'MSFT','AMZN':'AMZN','NVDA':'NVDA','META':'META',
};

// ── Yahoo Finance cookie/crumb state ───────────────────────────────────────
let yahooCookies = '';
let yahooCrumb   = '';
let crumbExpiry  = 0;

async function refreshYahooCrumb(): Promise<boolean> {
  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    // 1) Hit fc.yahoo.com to get session cookies
    const r1 = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': ua, 'Accept': '*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const rawCookies: string[] = (r1.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    yahooCookies = rawCookies.map((c: string) => c.split(';')[0]).join('; ');

    // 2) Fetch crumb
    const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': ua, 'Cookie': yahooCookies },
      signal: AbortSignal.timeout(6000),
    });
    if (!r2.ok) {
      console.warn('Yahoo crumb fetch failed:', r2.status);
      return false;
    }
    yahooCrumb = await r2.text();
    crumbExpiry = Date.now() + 3_600_000; // 1 h
    console.log('Yahoo Finance crumb refreshed');
    return true;
  } catch (e) {
    console.warn('refreshYahooCrumb error:', (e as Error).message);
    return false;
  }
}

async function fetchYahooPrices(): Promise<void> {
  if (!yahooCrumb || Date.now() > crumbExpiry) {
    const ok = await refreshYahooCrumb();
    if (!ok) return;
  }

  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const syms = Object.values(YAHOO_MAP).join(',');
    const url  = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&crumb=${encodeURIComponent(yahooCrumb)}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': ua, 'Cookie': yahooCookies, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401 || res.status === 403) {
      yahooCrumb = ''; // force refresh next cycle
      return;
    }
    if (!res.ok) return;

    type Quote = { symbol: string; regularMarketPrice?: number; regularMarketChangePercent?: number };
    type YResp = { quoteResponse?: { result?: Quote[] } };
    const data = await res.json() as YResp;
    const quotes = data?.quoteResponse?.result ?? [];
    const now = Date.now();

    for (const q of quotes) {
      if (q.regularMarketPrice == null) continue;
      const ourSym = Object.entries(YAHOO_MAP).find(([, v]) => v === q.symbol)?.[0];
      if (ourSym) {
        priceCache[ourSym] = {
          price: q.regularMarketPrice,
          timestamp: now,
          source: 'yahoo',
          change24h: q.regularMarketChangePercent,
        };
      }
    }
  } catch (e) {
    console.warn('Yahoo fetch error:', (e as Error).message);
  }
}

// Metals handled via Yahoo Finance (GC=F, SI=F) — no separate fetch needed

// ── Binance REST (backup for crypto) ──────────────────────────────────────
async function fetchCryptoPrices(): Promise<void> {
  try {
    const syms = JSON.stringify(CRYPTO_SYMBOLS);
    const res  = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(syms)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = await res.json() as { symbol: string; price: string }[];
    const now  = Date.now();
    for (const d of data) {
      priceCache[d.symbol] = { price: parseFloat(d.price), timestamp: now, source: 'binance' };
    }
  } catch { /* keep cached */ }
}

// ── Public API ─────────────────────────────────────────────────────────────
export function getPriceCache(): Record<string, CachedPrice> { return priceCache; }
export function getPrice(symbol: string): CachedPrice | null { return priceCache[symbol.toUpperCase()] ?? null; }

export function startPriceService(): void {
  // Initial fetches
  fetchCryptoPrices();
  refreshYahooCrumb().then(ok => { if (ok) fetchYahooPrices(); });

  // Crypto backup: every 2 s
  setInterval(fetchCryptoPrices, 2000);

  // Forex / metals / indices / stocks via Yahoo Finance: every 3 s
  setInterval(fetchYahooPrices, 3000);

  console.log('Price service started → Binance REST (2s) | Yahoo Finance forex/metals/indices/stocks (3s)');
}
