import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../constants';

interface Signal {
  market: string; direction: 'BUY' | 'SELL'; winChance: number;
  entry: number; stopLoss: number; takeProfit: number;
  positionSize: number; riskAmount: number; targetAmount: number; rr: number;
}
interface Resp { generatedAt: number; nextRefresh: number; capital: number; signals: Signal[]; }

const Signals: React.FC = () => {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchSignals = (token: string | null) =>
    fetch(`${API_BASE}/signals`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(25000),
    });

  const attempt = async (): Promise<Resp> => {
    let res = await fetchSignals(localStorage.getItem('rmp_token'));
    // Stale/expired token → start a fresh guest session and retry once
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
    setLoading(true); setErr('');
    // Up to 3 tries with backoff — transparently rides out free-tier cold starts.
    let lastErr: Error | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        setData(await attempt());
        setLoading(false);
        return;
      } catch (e) {
        lastErr = e as Error;
        if (i < 2) {
          setErr(`Server waking up… retrying (${i + 1}/2)`);
          await new Promise(r => setTimeout(r, 6000));
        }
      }
    }
    const ex = lastErr as Error;
    const reason = ex?.name === 'TimeoutError' || ex?.name === 'AbortError'
      ? 'the server is taking too long to wake up — wait ~30s and tap Refresh'
      : ex?.message?.startsWith('HTTP') || ex?.message?.startsWith('session')
        ? `the server returned ${ex.message}`
        : `network error (${ex?.message || ex?.name || 'request blocked'})`;
    setErr(`Could not load signals — ${reason}.`);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 800, margin: 0 }}>🎯 AI Signals</h1>
        <button onClick={load} disabled={loading} className="primary-btn" style={{ opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>
      <p style={{ color: '#888', fontSize: 12.5, margin: '0 0 4px', lineHeight: 1.5 }}>
        MACD 35/65/14 + UT Bot on 30-minute candles · updates every 30 min · sized to your capital &amp; targets
      </p>
      {data && (
        <p style={{ color: '#666', fontSize: 11.5, margin: '0 0 18px' }}>
          Capital ${data.capital.toLocaleString()} · Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Next {new Date(data.nextRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {err && (
        <div style={{ background: 'var(--surface)', border: '1px solid #FF174440', borderRadius: 12, padding: 20, textAlign: 'center', marginTop: 12 }}>
          <p style={{ color: '#FF1744', margin: '0 0 12px', fontSize: 14 }}>{err}</p>
          <button onClick={load} className="primary-btn">Try Again</button>
        </div>
      )}

      {loading && !data && !err && <p style={{ color: '#888', marginTop: 16 }}>Scanning markets…</p>}

      {/* Signal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 8 }}>
        {data?.signals.map((s, i) => {
          const buy = s.direction === 'BUY';
          const col = buy ? '#00C853' : '#FF1744';
          return (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderTop: `3px solid ${col}`, borderRadius: 14, padding: 18,
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 800 }}>{s.market.replace('USDT', '')}<span style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>/USDT</span></span>
                <span style={{ background: col, color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 20, letterSpacing: '0.03em' }}>
                  {buy ? '▲ BUY' : '▼ SELL'}
                </span>
              </div>

              {/* Win chance */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Chance</span>
                  <span style={{ color: col, fontSize: 13, fontWeight: 800 }}>{s.winChance}%</span>
                </div>
                <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${s.winChance}%`, height: '100%', background: col, transition: 'width 0.3s' }} />
                </div>
              </div>

              <Row label="Entry" value={s.entry} />
              <Row label="Stop Loss" value={s.stopLoss} color="#FF1744" />
              <Row label="Take Profit" value={s.takeProfit} color="#00C853" />
              <Row label="Size (units)" value={s.positionSize} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: '#FF1744', fontSize: 11.5, fontWeight: 600 }}>Risk ${s.riskAmount}</span>
                <span style={{ background: 'var(--border)', color: 'var(--text)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>1:{s.rr}</span>
                <span style={{ color: '#00C853', fontSize: 11.5, fontWeight: 600 }}>Target ${s.targetAmount}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ color: '#555', fontSize: 11, marginTop: 22, lineHeight: 1.5 }}>
        ⚠ Signals are algorithmic and for educational purposes only — not financial advice. Always manage your own risk.
      </p>
    </div>
  );
};

const Row: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
    <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
    <span style={{ color: color ?? 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

export default Signals;
