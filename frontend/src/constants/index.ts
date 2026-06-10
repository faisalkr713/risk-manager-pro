export const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export const ASSET_TYPES = [
  'Forex', 'Crypto', 'Metals', 'Indices', 'Stocks', 'Commodities', 'Futures', 'Custom',
] as const;

export const SYMBOLS_BY_TYPE: Record<string, string[]> = {
  Forex:       ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCHF','NZDUSD','GBPJPY','EURJPY','EURGBP','CADJPY'],
  Crypto:      ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','MATICUSDT','LINKUSDT','DOTUSDT','LTCUSDT'],
  Metals:      ['XAUUSD','XAGUSD'],
  Indices:     ['NAS100','US30','SPX500','UK100','GER40'],
  Stocks:      ['AAPL','TSLA','GOOGL','MSFT','AMZN','NVDA','META'],
  Commodities: ['USOIL','UKOIL','NATGAS'],
  Futures:     ['NAS100','US30','SPX500','USOIL'],
  Custom:      [],
};

// Search aliases: lowercase keyword → canonical symbol
export const SYMBOL_ALIASES: Record<string, string> = {
  'bitcoin':'BTCUSDT','btc':'BTCUSDT',
  'ethereum':'ETHUSDT','eth':'ETHUSDT',
  'solana':'SOLUSDT','sol':'SOLUSDT',
  'ripple':'XRPUSDT','xrp':'XRPUSDT',
  'gold':'XAUUSD','xau':'XAUUSD',
  'silver':'XAGUSD','xag':'XAGUSD',
  'nasdaq':'NAS100','nas':'NAS100','nq':'NAS100','nas100':'NAS100',
  'dow':'US30','djia':'US30','dow30':'US30',
  'sp500':'SPX500','s&p':'SPX500','spx':'SPX500','s&p500':'SPX500',
  'oil':'USOIL','crude':'USOIL','wti':'USOIL',
  'brent':'UKOIL',
  'gas':'NATGAS','natgas':'NATGAS',
  'euro':'EURUSD','eur':'EURUSD',
  'pound':'GBPUSD','gbp':'GBPUSD','cable':'GBPUSD',
  'yen':'USDJPY','jpy':'USDJPY',
  'aussie':'AUDUSD','aud':'AUDUSD',
};

export const COLORS = {
  bg: '#121212',
  card: '#1E1E1E',
  cardHover: '#252525',
  border: '#2A2A2A',
  success: '#00C853',
  danger: '#FF1744',
  warning: '#FFD600',
  accent: '#2979FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#666666',
} as const;

export const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',          icon: '📊' },
  { id: 'calculator',  label: 'Risk Calculator',     icon: '🧮' },
  { id: 'discipline',  label: 'Discipline Mode',     icon: '🛡️' },
  { id: 'journal',     label: 'Trade Journal',       icon: '📓' },
  { id: 'statistics',  label: 'Statistics',          icon: '📈' },
  { id: 'brokers',     label: 'Broker Profiles',     icon: '🏦' },
  { id: 'assets',      label: 'Asset Manager',       icon: '💎' },
  { id: 'screenshot',  label: 'Screenshot Analyzer', icon: '📷' },
  { id: 'upgrade',     label: 'Upgrade to Pro',      icon: '⚡' },
] as const;
