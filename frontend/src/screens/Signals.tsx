import React, { useEffect, useState, useCallback, useRef } from 'react';
import { API_BASE } from '../constants';

interface Signal {
  market: string; direction: 'BUY' | 'SELL'; winChance: number;
  entry: number; stopLoss: number; takeProfit: number;
  positionSize: number; profitPerTrade: number; lossPerTrade: number; rr: number;
}
interface Resp {
  windowStart: number; nextRefresh: number; entryDeadline: number;
  marketOpen: boolean; capital: number; signals: Signal[];
}

const fmt = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60), s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

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
    const waits = [3000, 5000, 7000, 9000, 11000];
    let lastErr: Error | null = null;
    for (let i = 0; i < waits.length + 1; i++) {
      try {
        setData(await attempt());
        setLoading(false); loadingRef.current = false;
        return;
      } catch (e) {
        lastErr = e as Error;
        if (i < waits.length) { setErr(`Server waking up… retrying (${i + 1}/${waits.length})`); await new Promise(r => setTimeout(r, waits[i])); }
      }
    }
    const ex = lastErr as Error;
    const reason = ex?.name === 'TimeoutError' || ex?.name === 'AbortError'
      ? 'the server is taking too long to wake up — it will retry automatically'
      : ex?.message?.startsWith('HTTP') || ex?.message?.startsWith('session')
        ? `the server returned ${ex.message}`
        : `network error (${ex?.message || ex?.name || 'request blocked'})`;
    setErr(`Could not load signals — ${reason}.`);
    setLoading(false); loadingRef.current = false;
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // 1-second clock for the countdown
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Auto-refresh when the 15-min window ends (only while the US market is open)
  useEffect(() => {
    if (data?.marketOpen && now >= data.nextRefresh && !loadingRef.current) {
      load();
    }
  }, [now, data, load]);

  const marketOpen = data?.marketOpen ?? true;
  const remaining = data ? data.nextRefresh - now : 0;          // to next signal set
  const entryRemaining = data ? data.entryDeadline - now : 0;   // entry window left
  const entryOpen = marketOpen && entryRemaining > 0;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 800, margin: 0 }}>🎯 AI Signals</h1>
      <p style={{ color: '#888', fontSize: 12.5, margin: '4px 0 0', lineHeight: 1.5 }}>
        MACD 35/65/14 + UT Bot on 15-minute candles · auto-updates every 15 min · sized to your capital &amp; targets
      </p>

      {/* Market closed banner */}
      {data && !marketOpen && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '16px 20px', margin: '16px 0', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🌙</div>
          <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: 16 }}>US market is closed</div>
          <div style={{ color: '#888', fontSize: 12.5, marginTop: 4 }}>
            AI signals are paused to conserve resources. They resume automatically at market open
            (Mon–Fri, 9:30 AM ET). Below are the last signals generated.
          </div>
        </div>
      )}

      {/* Countdown panel */}
      {data && marketOpen && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 20px', margin: '16px 0',
        }}>
          <div>
            <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Next signals in</div>
            <div style={{ color: 'var(--text)', fontSize: 30, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1 }}>{fmt(remaining)}</div>
          </div>
          <div style={{
            padding: '8px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, textAlign: 'center',
            background: entryOpen ? 'rgba(0,200,83,0.12)' : 'rgba(255,23,68,0.10)',
            color: entryOpen ? '#00C853' : '#FF1744', border: `1px solid ${entryOpen ? '#00C85340' : '#FF174440'}`,
          }}>
            {entryOpen
              ? <>✅ ENTRY OPEN · take within {fmt(entryRemaining)}</>
              : <>🔒 ENTRY CLOSED · wait for next signals</>}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
        {data?.signals.map((s, i) => {
          const buy = s.direction === 'BUY';
          const col = buy ? '#00C853' : '#FF1744';
          return (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderTop: `3px solid ${col}`, borderRadius: 14, padding: 18,
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)', opacity: entryOpen ? 1 : 0.65,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 800 }}>
                  {s.market.replace('USDT', '')}<span style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>/USDT</span>
                </span>
                <span style={{ background: col, color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 20 }}>
                  {buy ? '▲ BUY' : '▼ SELL'}
                </span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Chance</span>
                  <span style={{ color: col, fontSize: 13, fontWeight: 800 }}>{s.winChance}%</span>
                </div>
                <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${s.winChance}%`, height: '100%', background: col }} />
                </div>
              </div>

              <Row label="Entry price" value={s.entry} />
              <Row label="Take profit (exit)" value={s.takeProfit} color="#00C853" />
              <Row label="Stop loss (exit)" value={s.stopLoss} color="#FF1744" />
              <Row label="Position size" value={`${s.positionSize} units`} />

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, background: 'rgba(0,200,83,0.08)', border: '1px solid #00C85333', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ color: '#00C853', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profit / trade</div>
                  <div style={{ color: '#00C853', fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>+${s.profitPerTrade}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,23,68,0.08)', border: '1px solid #FF174433', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ color: '#FF1744', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Loss / trade</div>
                  <div style={{ color: '#FF1744', fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>-${s.lossPerTrade}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, color: '#888', fontSize: 11 }}>Risk:Reward 1:{s.rr}</div>

              <div style={{
                marginTop: 12, textAlign: 'center', fontSize: 11.5, fontWeight: 700,
                color: entryOpen ? '#00C853' : '#FF1744',
              }}>
                {entryOpen ? `Take now — ${fmt(entryRemaining)} left` : 'Do not enter — wait for next signal'}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ color: '#555', fontSize: 11, marginTop: 22, lineHeight: 1.5 }}>
        ⚠ Enter a trade only while the entry window is open (first 5 minutes of each 15-min cycle). If under 10 minutes
        remain on the countdown, skip it and wait for the next signal set. Algorithmic &amp; educational only — not financial advice.
      </p>
    </div>
  );
};

const Row: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
    <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
    <span style={{ color: color ?? 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

export default Signals;
