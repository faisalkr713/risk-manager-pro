import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { API_BASE } from '../constants';

interface Signal {
  market: string; direction: 'BUY' | 'SELL'; winChance: number;
  entry: number; stopLoss: number; takeProfit: number; takeProfit2: number;
  positionSize: number; profitPerTrade: number; lossPerTrade: number; rr: number;
  spark: number[];
}
interface Resp {
  windowStart: number; nextRefresh: number; entryDeadline: number;
  marketOpen: boolean; capital: number; signals: Signal[];
}

const fmt = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

const Signals: React.FC = () => {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const loadingRef = useRef(false);

  const fetchSignals = (token: string | null) =>
    fetch(`${API_BASE}/signals`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000) });

  const attempt = async (): Promise<Resp> => {
    let res = await fetchSignals(localStorage.getItem('rmp_token'));
    if (res.status === 401) {
      const g = await fetch(`${API_BASE}/auth/guest`, { method: 'POST', signal: AbortSignal.timeout(25000) });
      if (!g.ok) throw new Error(`session ${g.status}`);
      const gd = await g.json();
      localStorage.setItem('rmp_token', gd.token);
      res = await fetchSignals(gd.token);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setErr('');
    // Long backoff (~70s total) so a free-tier cold start fully completes before we give up.
    const waits = [2000, 4000, 6000, 8000, 10000, 12000, 14000, 14000];
    let lastErr: Error | null = null;
    for (let i = 0; i < waits.length + 1; i++) {
      try { setData(await attempt()); setLoading(false); loadingRef.current = false; return; }
      catch (e) {
        lastErr = e as Error;
        if (i < waits.length) { setErr(`Waking up the server… retrying (${i + 1}/${waits.length})`); await new Promise(r => setTimeout(r, waits[i])); }
      }
    }
    const ex = lastErr as Error;
    const reason = ex?.name === 'TimeoutError' || ex?.name === 'AbortError'
      ? 'the server is taking too long to wake up — it will retry automatically'
      : ex?.message?.startsWith('HTTP') || ex?.message?.startsWith('session') ? `the server returned ${ex.message}`
        : `network error (${ex?.message || ex?.name || 'request blocked'})`;
    setErr(`Could not load signals — ${reason}.`);
    setLoading(false); loadingRef.current = false;
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (data?.marketOpen && now >= data.nextRefresh && !loadingRef.current) load(); }, [now, data, load]);

  const marketOpen = data?.marketOpen ?? true;
  const remaining = data ? data.nextRefresh - now : 0;
  const entryRemaining = data ? data.entryDeadline - now : 0;
  const entryOpen = marketOpen && entryRemaining > 0;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>⚡ Live Signals</h1>
        <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>TradeCalculate AI · MACD 35/65/14 × UT-Bot · 15-minute candles</p>
      </div>

      {/* Market closed */}
      {data && !marketOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', margin: '16px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 26 }}>🌙</div>
          <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: 15 }}>US market is closed</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Signals paused to save resources · resume Mon–Fri 9:30 AM ET. Last set shown below.</div>
        </div>
      )}

      {/* Countdown */}
      {data && marketOpen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 18px', margin: '16px 0' }}>
          <div>
            <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next signals in</div>
            <div style={{ color: 'var(--text)', fontSize: 26, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1 }}>{fmt(remaining)}</div>
          </div>
          <div style={{ padding: '7px 14px', borderRadius: 10, fontWeight: 800, fontSize: 12.5, background: entryOpen ? 'rgba(0,200,83,0.12)' : 'rgba(255,23,68,0.10)', color: entryOpen ? '#00C853' : '#FF1744', border: `1px solid ${entryOpen ? '#00C85340' : '#FF174440'}` }}>
            {entryOpen ? <>✅ ENTRY OPEN · {fmt(entryRemaining)} to enter</> : <>🔒 ENTRY CLOSED · wait for next set</>}
          </div>
        </div>
      )}

      {err && (
        <div style={{ background: 'var(--surface)', border: '1px solid #FF174440', borderRadius: 12, padding: 20, textAlign: 'center', marginTop: 12 }}>
          <p style={{ color: '#FF1744', margin: '0 0 12px', fontSize: 14 }}>{err}</p>
          <button onClick={load} className="primary-btn">Try Again</button>
        </div>
      )}
      {loading && !data && !err && <p style={{ color: '#888', marginTop: 16 }}>Scanning markets…</p>}

      {/* Signal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {data?.signals.map((s, i) => (
          <SignalCard key={i} s={s} entryOpen={entryOpen} windowStart={data.windowStart} />
        ))}
      </div>

      <p style={{ color: '#555', fontSize: 11, marginTop: 22, lineHeight: 1.5 }}>
        ⚠ Enter only while the window is OPEN (first 5 minutes of each 15-min cycle). If under 10 minutes remain, skip and wait
        for the next set. Algorithmic &amp; educational only — not financial advice.
      </p>
    </div>
  );
};

const SignalCard: React.FC<{ s: any; entryOpen: boolean; windowStart: number }> = ({ s, entryOpen, windowStart }) => {
  const buy = s.direction === 'BUY';
  const col = buy ? '#00C853' : '#FF1744';
  const chartData = (s.spark as number[]).map((v, idx) => ({ idx, v }));

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', opacity: entryOpen ? 1 : 0.7,
    }}>
      {/* Header bar */}
      <div style={{ background: 'var(--surface-hover)', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text)', fontSize: 19, fontWeight: 800, letterSpacing: '0.02em' }}>{s.market.replace('USDT', 'USD')}</span>
          <span style={{ background: col, color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: '0.05em' }}>
            {buy ? 'LONG' : 'SHORT'}
          </span>
        </div>
        <div style={{ color: '#888', fontSize: 11.5, marginTop: 3 }}>Model: TradeCalculate AI</div>
      </div>

      <div style={{ padding: '14px 18px 18px' }}>
        {/* Price levels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 14px', marginBottom: 14 }}>
          <Lvl label="ENTRY" value={s.entry} />
          <Lvl label="STOP" value={s.stopLoss} color="#FF1744" />
          <Lvl label="TP1" value={s.takeProfit} color="#00C853" />
          <Lvl label="TP2" value={s.takeProfit2} color="#00C853" />
        </div>

        {/* Confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ color: '#888', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Confidence {s.winChance}%</span>
          <div style={{ flex: 1, height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${s.winChance}%`, height: '100%', background: '#2979FF', borderRadius: 4 }} />
          </div>
        </div>

        {/* Mini chart */}
        <div style={{ height: 64, margin: '0 -4px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={`g${s.market}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={col} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={col} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area type="monotone" dataKey="v" stroke={col} strokeWidth={2} fill={`url(#g${s.market})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 11 }}>
          <span style={{ color: '#00C853', fontWeight: 700 }}>+${s.profitPerTrade} / {s.positionSize}u</span>
          <span style={{ color: '#888' }}>1:{s.rr}</span>
          <span style={{ color: '#555' }}>{utc(windowStart)}</span>
        </div>

        {/* Action button */}
        {entryOpen ? (
          <div style={{ background: col, color: '#fff', textAlign: 'center', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 14, letterSpacing: '0.04em' }}>
            ENTER TRADE
          </div>
        ) : (
          <div style={{ background: 'var(--border)', color: '#888', textAlign: 'center', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 14, letterSpacing: '0.04em' }}>
            WAIT
          </div>
        )}
      </div>
    </div>
  );
};

const Lvl: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
    <span style={{ color: '#888', fontSize: 11, fontWeight: 700 }}>{label}</span>
    <span style={{ color: color ?? 'var(--text)', fontSize: 13.5, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

export default Signals;
