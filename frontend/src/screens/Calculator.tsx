import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ASSET_TYPES, SYMBOLS_BY_TYPE, SYMBOL_ALIASES, COLORS } from '../constants';
import { calculateRisk, getDefaultContractSpec, formatCurrency, formatPrice } from '../utils/calculations';
import { CalcResult, Settings } from '../types';
import { apiGet } from '../hooks/useApi';
import { useBinanceStream } from '../hooks/useBinanceStream';
import { useAllPrices } from '../hooks/usePrices';
import { API_BASE } from '../constants';

type Mode = 'simple' | 'advanced';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(4);
  return p.toFixed(6);
}

function fmtChange(c: number): string {
  return `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`;
}

/* ── Main component ──────────────────────────────────────────────────────── */
const Calculator: React.FC = () => {
  const [mode, setMode]               = useState<Mode>('simple');
  const [assetType, setAssetType]     = useState('Crypto');
  const [symbol, setSymbol]           = useState('BTCUSDT');
  const [searchQuery, setSearchQuery] = useState('');
  const [direction, setDirection]     = useState<'BUY' | 'SELL'>('BUY');
  const [entryPrice, setEntryPrice]   = useState('');
  const [stopLoss, setStopLoss]       = useState('');
  const [riskAmount, setRiskAmount]   = useState('5');
  const [rrRatio, setRrRatio]         = useState('2');
  const [leverage, setLeverage]       = useState('100');
  const [balance, setBalance]         = useState('470');
  const [contractSize, setContractSize] = useState('1');
  const [tickSize, setTickSize]         = useState('0.01');
  const [tickValue, setTickValue]       = useState('1');
  const [result, setResult]           = useState<CalcResult | null>(null);
  const [savedMsg, setSavedMsg]       = useState('');
  const entryLocked = useRef(false);

  // Live data sources
  const cryptoTickers = useBinanceStream();          // WebSocket → sub-second
  const restPrices    = useAllPrices();              // REST polling → for non-crypto

  // Load settings
  useEffect(() => {
    apiGet<Settings>('/settings').then(s => {
      setBalance(s.balance);
      setRiskAmount(s.risk_per_trade);
    }).catch(() => {});
  }, []);

  // Update contract specs when asset type changes
  useEffect(() => {
    const spec = getDefaultContractSpec(assetType);
    setContractSize(String(spec.contractSize));
    setTickSize(String(spec.tickSize));
    setTickValue(String(spec.tickValue));
    const syms = SYMBOLS_BY_TYPE[assetType] ?? [];
    if (syms.length > 0) { setSymbol(syms[0]); entryLocked.current = false; }
  }, [assetType]);

  // Reset when symbol changes
  useEffect(() => {
    entryLocked.current = false;
    setEntryPrice('');
    setStopLoss('');
    setResult(null);
  }, [symbol]);

  // Get current live price for selected symbol
  const livePrice = useMemo(() => {
    if (assetType === 'Crypto') return cryptoTickers[symbol]?.price ?? null;
    return restPrices[symbol]?.price ?? null;
  }, [assetType, symbol, cryptoTickers, restPrices]);

  // Auto-fill entry from live price (first time only)
  useEffect(() => {
    if (livePrice && !entryLocked.current) {
      setEntryPrice(String(livePrice));
      entryLocked.current = true;
    }
  }, [livePrice]);

  // Auto-calculate
  useEffect(() => {
    const entry = parseFloat(entryPrice);
    const sl    = parseFloat(stopLoss);
    const risk  = parseFloat(riskAmount);
    const rrr   = parseFloat(rrRatio);
    if (!entry || !sl || !risk || !rrr || entry === sl) { setResult(null); return; }
    setResult(calculateRisk({
      assetType, direction,
      entryPrice: entry, stopLossPrice: sl,
      riskAmount: risk, rewardRiskRatio: rrr,
      leverage: parseFloat(leverage) || 1,
      contractSize: parseFloat(contractSize) || 1,
      tickSize: parseFloat(tickSize) || 0.01,
      tickValue: parseFloat(tickValue) || 1,
      accountBalance: parseFloat(balance) || 0,
    }));
  }, [entryPrice, stopLoss, riskAmount, rrRatio, leverage, contractSize, tickSize, tickValue, direction, assetType, balance]);

  // Filtered symbol list
  const filteredSymbols = useMemo(() => {
    const base = SYMBOLS_BY_TYPE[assetType] ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    const alias = SYMBOL_ALIASES[q];
    if (alias && base.includes(alias)) return [alias, ...base.filter(s => s !== alias)];
    return base.filter(s => s.toLowerCase().includes(q));
  }, [assetType, searchQuery]);

  const handleSelectSymbol = useCallback((s: string) => {
    setSymbol(s);
    setSearchQuery('');
    entryLocked.current = false;
  }, []);

  const useLatestLive = useCallback(() => {
    if (livePrice) { setEntryPrice(String(livePrice)); entryLocked.current = true; }
  }, [livePrice]);

  const saveTrade = async () => {
    if (!result) return;
    try {
      await fetch(`${API_BASE}/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, direction,
          entry_price: parseFloat(entryPrice),
          stop_loss: parseFloat(stopLoss),
          take_profit: result.takeProfit,
          quantity: result.quantity,
          result: 'pending',
          profit_loss: 0,
          notes: `Risk $${result.potentialLoss.toFixed(2)} | TP ${formatPrice(result.takeProfit)}`,
        }),
      });
      setSavedMsg('✓ Trade saved to journal');
    } catch { setSavedMsg('Failed to save'); }
    setTimeout(() => setSavedMsg(''), 3000);
  };

  // Props shared between modes
  const shared = {
    assetType, setAssetType,
    symbol, onSelectSymbol: handleSelectSymbol,
    searchQuery, setSearchQuery,
    filteredSymbols,
    direction, setDirection,
    entryPrice, setEntryPrice,
    stopLoss, setStopLoss,
    riskAmount, setRiskAmount,
    rrRatio, setRrRatio,
    livePrice,
    cryptoTickers, restPrices,
    result,
    onUseLive: useLatestLive,
    onSave: saveTrade,
    savedMsg,
  };

  return (
    <div className="calc-root">
      <div className="calc-header">
        <div>
          <h1 className="screen-title">Risk Calculator</h1>
          <p className="screen-sub">Binance live prices • Instant calculations</p>
        </div>
        <div className="mode-toggle">
          <button className={`mode-btn${mode === 'simple' ? ' active' : ''}`} onClick={() => setMode('simple')}>Simple</button>
          <button className={`mode-btn${mode === 'advanced' ? ' active' : ''}`} onClick={() => setMode('advanced')}>Advanced</button>
        </div>
      </div>

      {mode === 'simple'
        ? <SimpleMode {...shared} balance={balance} />
        : <AdvancedMode {...shared} balance={balance} setBalance={setBalance}
            leverage={leverage} setLeverage={setLeverage}
            contractSize={contractSize} setContractSize={setContractSize}
            tickSize={tickSize} setTickSize={setTickSize}
            tickValue={tickValue} setTickValue={setTickValue}
          />
      }
    </div>
  );
};

/* ── Symbol button with live price ──────────────────────────────────────── */
interface SymbolBtnProps {
  sym: string;
  active: boolean;
  onClick: () => void;
  price?: number;
  prevPrice?: number;
  change?: number;
}

const SymbolBtn: React.FC<SymbolBtnProps> = ({ sym, active, onClick, price, change }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (price == null) return;
    if (prevRef.current != null && price !== prevRef.current) {
      setFlash(price > prevRef.current ? 'up' : 'down');
      setTimeout(() => setFlash(null), 400);
    }
    prevRef.current = price;
  }, [price]);

  return (
    <button
      className={`sym-btn${active ? ' active' : ''}${flash === 'up' ? ' flash-up' : flash === 'down' ? ' flash-down' : ''}`}
      onClick={onClick}
    >
      <span className="sym-name">{sym.replace('USDT', '')}</span>
      {price != null ? (
        <>
          <span className="sym-price">{fmtPrice(price)}</span>
          {change != null && (
            <span className={`sym-change ${change >= 0 ? 'pos' : 'neg'}`}>{fmtChange(change)}</span>
          )}
        </>
      ) : (
        <span className="sym-loading">…</span>
      )}
    </button>
  );
};

/* ── Shared subcomponents ────────────────────────────────────────────────── */
interface SharedProps {
  assetType: string; setAssetType: (v: string) => void;
  symbol: string; onSelectSymbol: (s: string) => void;
  searchQuery: string; setSearchQuery: (v: string) => void;
  filteredSymbols: string[];
  direction: 'BUY' | 'SELL'; setDirection: (v: 'BUY' | 'SELL') => void;
  entryPrice: string; setEntryPrice: (v: string) => void;
  stopLoss: string; setStopLoss: (v: string) => void;
  riskAmount: string; setRiskAmount: (v: string) => void;
  rrRatio: string; setRrRatio: (v: string) => void;
  livePrice: number | null;
  cryptoTickers: Record<string, { price: number; prevPrice: number; changePercent: number }>;
  restPrices: Record<string, { price: number }>;
  result: CalcResult | null;
  onUseLive: () => void;
  onSave: () => void;
  savedMsg: string;
  balance: string;
}

/* ─── Symbol picker shared ───────────────────────────────────────────────── */
const SymbolPicker: React.FC<{
  assetType: string;
  symbol: string;
  onSelect: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredSymbols: string[];
  cryptoTickers: SharedProps['cryptoTickers'];
  restPrices: SharedProps['restPrices'];
}> = ({ assetType, symbol, onSelect, searchQuery, setSearchQuery, filteredSymbols, cryptoTickers, restPrices }) => (
  <div>
    <input
      className="search-input"
      placeholder={`Search ${assetType} symbols… (e.g. "gold", "btc", "nasdaq")`}
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
    />
    <div className="sym-grid">
      {filteredSymbols.slice(0, 16).map(s => {
        const t = cryptoTickers[s];
        const r = restPrices[s];
        return (
          <SymbolBtn
            key={s}
            sym={s}
            active={symbol === s}
            onClick={() => onSelect(s)}
            price={t?.price ?? r?.price}
            prevPrice={t?.prevPrice}
            change={t?.changePercent}
          />
        );
      })}
    </div>
  </div>
);

/* ─── Live price bar ─────────────────────────────────────────────────────── */
const LiveBar: React.FC<{ symbol: string; livePrice: number | null; assetType: string; cryptoTickers: SharedProps['cryptoTickers'] }> = ({ symbol, livePrice, assetType, cryptoTickers }) => {
  const ticker = cryptoTickers[symbol];
  if (!livePrice) return <div className="price-loading">Connecting to live feed…</div>;
  return (
    <div className="live-price-bar">
      <span className="live-dot" />
      <span className="live-symbol">{symbol}</span>
      <span className="live-value">{fmtPrice(livePrice)}</span>
      {assetType === 'Crypto' && ticker?.changePercent != null && (
        <span className={ticker.changePercent >= 0 ? 'change-pos' : 'change-neg'}>
          {fmtChange(ticker.changePercent)}
        </span>
      )}
      <span className="live-badge">{assetType === 'Crypto' ? 'BINANCE LIVE' : 'LIVE'}</span>
    </div>
  );
};

/* ── Simple Mode ─────────────────────────────────────────────────────────── */
const SimpleMode: React.FC<SharedProps> = (p) => (
  <div className="simple-layout">
    {/* LEFT — inputs */}
    <div className="simple-left">
      <StepCard step={1} title="Select Market">
        <div className="market-pills">
          {(ASSET_TYPES as readonly string[]).filter(t => t !== 'Custom' && t !== 'Futures').map(t => (
            <button key={t} className={`pill${p.assetType === t ? ' active' : ''}`} onClick={() => p.setAssetType(t)}>{t}</button>
          ))}
        </div>
      </StepCard>

      <StepCard step={2} title="Select Symbol">
        <SymbolPicker
          assetType={p.assetType} symbol={p.symbol} onSelect={p.onSelectSymbol}
          searchQuery={p.searchQuery} setSearchQuery={p.setSearchQuery}
          filteredSymbols={p.filteredSymbols}
          cryptoTickers={p.cryptoTickers} restPrices={p.restPrices}
        />
        <LiveBar symbol={p.symbol} livePrice={p.livePrice} assetType={p.assetType} cryptoTickers={p.cryptoTickers} />
      </StepCard>

      <StepCard step={3} title="Direction">
        <div className="dir-row">
          <button className={`dir-btn buy${p.direction === 'BUY' ? ' active' : ''}`} onClick={() => p.setDirection('BUY')}>▲ BUY</button>
          <button className={`dir-btn sell${p.direction === 'SELL' ? ' active' : ''}`} onClick={() => p.setDirection('SELL')}>▼ SELL</button>
        </div>
      </StepCard>

      <StepCard step={4} title="Entry &amp; Stop Loss">
        <div className="price-inputs">
          <div className="input-group">
            <label className="input-label">Entry Price</label>
            <div style={{ position: 'relative' }}>
              <input className="price-input" type="number" step="any" value={p.entryPrice} onChange={e => p.setEntryPrice(e.target.value)} placeholder="Auto-filled from live price" />
              {p.livePrice && <button className="use-live-btn" onClick={p.onUseLive}>↺ {fmtPrice(p.livePrice)}</button>}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Stop Loss</label>
            <input className={`price-input${!p.stopLoss ? ' highlight' : ''}`} type="number" step="any" value={p.stopLoss} onChange={e => p.setStopLoss(e.target.value)} placeholder="Enter your stop loss price…" />
          </div>
        </div>
        <div className="mini-row">
          <div className="mini-input-group">
            <label className="input-label">Risk ($)</label>
            <input className="mini-input" type="number" value={p.riskAmount} onChange={e => p.setRiskAmount(e.target.value)} />
          </div>
          <div className="mini-input-group">
            <label className="input-label">RR Ratio</label>
            <input className="mini-input" type="number" step="0.1" value={p.rrRatio} onChange={e => p.setRrRatio(e.target.value)} />
          </div>
        </div>
      </StepCard>
    </div>

    {/* RIGHT — results always visible */}
    <div className="simple-right">
      {p.result ? (
        <StepCard step={5} title="Results">
          <div className="results-grid">
            <ResultTile label="Take Profit"  value={formatPrice(p.result.takeProfit)}  color={p.direction === 'BUY' ? COLORS.success : COLORS.danger} />
            <ResultTile label="Quantity"     value={p.result.quantity >= 1 ? p.result.quantity.toLocaleString() : p.result.quantity.toFixed(6)} />
            <ResultTile label="Lot Size"     value={p.result.lotSize.toFixed(4)} />
            <ResultTile label="Margin"       value={formatCurrency(p.result.marginRequired)} color={COLORS.warning} />
            <ResultTile label="Risk %"       value={`${p.result.riskPercent.toFixed(2)}%`} color={p.result.riskPercent > 2 ? COLORS.danger : COLORS.success} />
            <ResultTile label="RR Ratio"     value={`1:${p.result.rrRatio}`}             color={COLORS.accent} />
          </div>
          <div className="pnl-row">
            <div className="pnl-card profit"><div className="pnl-label">Potential Profit</div><div className="pnl-value">+{formatCurrency(p.result.potentialProfit)}</div></div>
            <div className="pnl-card loss">  <div className="pnl-label">Potential Loss</div>  <div className="pnl-value">-{formatCurrency(p.result.potentialLoss)}</div></div>
          </div>
          <button className="save-btn" onClick={p.onSave}>💾 Save Trade to Journal</button>
          {p.savedMsg && <div className="save-msg">{p.savedMsg}</div>}
        </StepCard>
      ) : (
        <div className="step-card">
          <div className="step-header">
            <span className="step-num">5</span>
            <span className="step-title">Results</span>
          </div>
          <div className="step-body empty-state">
            <span style={{ fontSize: 48 }}>🧮</span>
            <p>Enter entry price &amp; stop loss<br/>for instant calculations</p>
          </div>
        </div>
      )}
    </div>
  </div>
);

/* ── Advanced Mode ───────────────────────────────────────────────────────── */
interface AdvProps extends SharedProps {
  setBalance: (v: string) => void;
  leverage: string; setLeverage: (v: string) => void;
  contractSize: string; setContractSize: (v: string) => void;
  tickSize: string; setTickSize: (v: string) => void;
  tickValue: string; setTickValue: (v: string) => void;
}

const AdvancedMode: React.FC<AdvProps> = (p) => (
  <div className="advanced-layout">
    <div className="adv-left">
      <div className="adv-card">
        <div className="adv-row">
          <div className="adv-field">
            <label className="input-label">Asset Type</label>
            <select className="adv-select" value={p.assetType} onChange={e => p.setAssetType(e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="adv-field" style={{ flex: 2, position: 'relative' }}>
            <label className="input-label">Symbol</label>
            <input className="adv-input" value={p.searchQuery || p.symbol} onChange={e => p.setSearchQuery(e.target.value)} placeholder="Search…" />
            {p.searchQuery && (
              <div className="adv-dropdown">
                {p.filteredSymbols.slice(0, 8).map(s => {
                  const t = p.cryptoTickers[s];
                  const r = p.restPrices[s];
                  const price = t?.price ?? r?.price;
                  return (
                    <button key={s} className="adv-drop-item" onClick={() => { p.onSelectSymbol(s); p.setSearchQuery(''); }}>
                      <span>{s}</span>
                      {price != null && <span style={{ color: '#B0B0B0', fontFamily: 'monospace', fontSize: 12, marginLeft: 'auto' }}>{fmtPrice(price)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <LiveBar symbol={p.symbol} livePrice={p.livePrice} assetType={p.assetType} cryptoTickers={p.cryptoTickers} />
      </div>

      {/* Symbol grid with prices */}
      <div className="adv-card">
        <div className="adv-section-title">Market Watch — {p.assetType}</div>
        <div className="sym-grid">
          {(SYMBOLS_BY_TYPE[p.assetType] ?? []).slice(0, 16).map(s => {
            const t = p.cryptoTickers[s];
            const r = p.restPrices[s];
            return (
              <SymbolBtn key={s} sym={s} active={p.symbol === s} onClick={() => p.onSelectSymbol(s)}
                price={t?.price ?? r?.price} prevPrice={t?.prevPrice} change={t?.changePercent} />
            );
          })}
        </div>
      </div>

      <div className="adv-card">
        <div className="dir-row">
          <button className={`dir-btn buy${p.direction === 'BUY' ? ' active' : ''}`} onClick={() => p.setDirection('BUY')}>▲ BUY / LONG</button>
          <button className={`dir-btn sell${p.direction === 'SELL' ? ' active' : ''}`} onClick={() => p.setDirection('SELL')}>▼ SELL / SHORT</button>
        </div>
      </div>

      <div className="adv-card">
        <div className="adv-row">
          {[
            { label: 'Entry Price', value: p.entryPrice, set: p.setEntryPrice, extra: p.livePrice ? <button className="use-live-btn" style={{ position: 'static', transform: 'none', marginTop: 4 }} onClick={p.onUseLive}>↺ {fmtPrice(p.livePrice)}</button> : null },
            { label: 'Stop Loss Price', value: p.stopLoss, set: p.setStopLoss },
            { label: 'Risk Amount ($)', value: p.riskAmount, set: p.setRiskAmount },
            { label: 'RR Ratio', value: p.rrRatio, set: p.setRrRatio },
            { label: 'Leverage', value: p.leverage, set: p.setLeverage },
            { label: 'Account Balance ($)', value: p.balance, set: p.setBalance },
          ].map(f => (
            <div key={f.label} className="adv-field">
              <label className="input-label">{f.label}</label>
              <input className="adv-input" type="number" step="any" value={f.value} onChange={e => f.set(e.target.value)} />
              {f.extra}
            </div>
          ))}
        </div>
      </div>

      <div className="adv-card">
        <div className="adv-section-title">Contract Specifications</div>
        <div className="adv-row">
          {[
            { label: 'Contract Size', value: p.contractSize, set: p.setContractSize },
            { label: 'Tick Size', value: p.tickSize, set: p.setTickSize },
            { label: 'Tick Value ($)', value: p.tickValue, set: p.setTickValue },
          ].map(f => (
            <div key={f.label} className="adv-field">
              <label className="input-label">{f.label}</label>
              <input className="adv-input" type="number" step="any" value={f.value} onChange={e => f.set(e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="adv-right">
      {p.result ? (
        <>
          <div className="adv-card">
            <div className="adv-section-title">Calculation Results</div>
            <div className="results-grid">
              <ResultTile label="Stop Distance"  value={formatPrice(p.result.stopDistance)} />
              <ResultTile label="Take Profit"    value={formatPrice(p.result.takeProfit)}    color={p.direction === 'BUY' ? COLORS.success : COLORS.danger} />
              <ResultTile label="Quantity"       value={p.result.quantity >= 1 ? p.result.quantity.toLocaleString() : p.result.quantity.toFixed(6)} />
              <ResultTile label="Lot Size"       value={p.result.lotSize.toFixed(4)} />
              <ResultTile label="Position Value" value={formatCurrency(p.result.positionValue)} />
              <ResultTile label="Margin"         value={formatCurrency(p.result.marginRequired)} color={COLORS.warning} />
              <ResultTile label="Risk %"         value={`${p.result.riskPercent.toFixed(2)}%`}   color={p.result.riskPercent > 2 ? COLORS.danger : COLORS.success} />
              <ResultTile label="RR Ratio"       value={`1:${p.result.rrRatio}`}                 color={COLORS.accent} />
            </div>
          </div>
          <div className="pnl-row">
            <div className="pnl-card profit"><div className="pnl-label">Potential Profit</div><div className="pnl-value">+{formatCurrency(p.result.potentialProfit)}</div><div className="pnl-sub">RR {p.result.rrRatio}:1</div></div>
            <div className="pnl-card loss">  <div className="pnl-label">Potential Loss</div>  <div className="pnl-value">-{formatCurrency(p.result.potentialLoss)}</div>  <div className="pnl-sub">{p.result.riskPercent.toFixed(2)}% of balance</div></div>
          </div>
          <button className="save-btn" onClick={p.onSave}>💾 Save Trade to Journal</button>
          {p.savedMsg && <div className="save-msg">{p.savedMsg}</div>}
        </>
      ) : (
        <div className="adv-card empty-state">
          <span style={{ fontSize: 48 }}>🧮</span>
          <p>Enter entry &amp; stop loss for instant results</p>
        </div>
      )}
    </div>
  </div>
);

/* ── Tiny shared pieces ──────────────────────────────────────────────────── */
const StepCard: React.FC<{ step: number; title: string; children: React.ReactNode }> = ({ step, title, children }) => (
  <div className="step-card">
    <div className="step-header">
      <span className="step-num">{step}</span>
      <span className="step-title" dangerouslySetInnerHTML={{ __html: title }} />
    </div>
    <div className="step-body">{children}</div>
  </div>
);

const ResultTile: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#FFF' }) => (
  <div className="result-tile">
    <div className="result-label">{label}</div>
    <div className="result-value" style={{ color }}>{value}</div>
  </div>
);

export default Calculator;
