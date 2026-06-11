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

  const load = useCallback(() => {
    const token = localStorage.getItem('rmp_token');
    setLoading(true);
    fetch(`${API_BASE}/signals`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData).catch(() => setErr('Could not load signals')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, margin: 0 }}>🎯 AI Signals</h1>
          <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>
            4 daily signals · MACD 35/65/14 + UT Bot on 30m candles · updates every 30 min · sized to your presets
          </p>
        </div>
        <button onClick={load} className="primary-btn">↻ Refresh</button>
      </div>

      {data && (
        <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
          Capital ${data.capital.toLocaleString()} · Updated {new Date(data.generatedAt).toLocaleTimeString()} · Next {new Date(data.nextRefresh).toLocaleTimeString()}
        </p>
      )}

      {loading && !data && <p style={{ color: '#888' }}>Loading signals…</p>}
      {err && <p style={{ color: '#FF1744' }}>{err}</p>}
      {data && data.signals.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center', color: '#888' }}>
          No clean signals right now. Markets are choppy — check back after the next 30-min candle.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {data?.signals.map((s, i) => {
          const buy = s.direction === 'BUY';
          const col = buy ? '#00C853' : '#FF1744';
          return (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${col}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: 'var(--text)', fontSize: 16, fontWeight: 800 }}>{s.market}</span>
                <span style={{ background: `${col}22`, color: col, fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                  {buy ? '▲ BUY' : '▼ SELL'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${s.winChance}%`, height: '100%', background: col }} />
                </div>
                <span style={{ color: col, fontSize: 13, fontWeight: 800 }}>{s.winChance}%</span>
              </div>
              <Row label="Entry" value={s.entry} />
              <Row label="Stop Loss" value={s.stopLoss} color="#FF1744" />
              <Row label="Take Profit" value={s.takeProfit} color="#00C853" />
              <Row label="Size (units)" value={s.positionSize} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: '#FF1744', fontSize: 12 }}>Risk ${s.riskAmount}</span>
                <span style={{ color: '#888', fontSize: 12 }}>RR 1:{s.rr}</span>
                <span style={{ color: '#00C853', fontSize: 12 }}>Target ${s.targetAmount}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ color: '#555', fontSize: 11, marginTop: 20 }}>
        ⚠ Signals are algorithmic and educational only — not financial advice. Always manage your own risk.
      </p>
    </div>
  );
};

const Row: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
    <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
    <span style={{ color: color ?? 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

export default Signals;
