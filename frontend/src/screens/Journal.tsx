import React, { useState, useEffect, useCallback } from 'react';
import { Trade } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi';
import { formatCurrency } from '../utils/calculations';

interface TradeForm {
  date: string;
  time: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: string;
  stop_loss: string;
  take_profit: string;
  quantity: string;
  result: 'WIN' | 'LOSS' | 'BE';
  profit_loss: string;
  notes: string;
}

const emptyForm = (): TradeForm => ({
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  symbol: '',
  direction: 'BUY',
  entry: '',
  stop_loss: '',
  take_profit: '',
  quantity: '',
  result: 'WIN',
  profit_loss: '',
  notes: '',
});

const Journal: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TradeForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDate) params.set('date', filterDate);
      if (filterSymbol) params.set('symbol', filterSymbol);
      if (filterDirection) params.set('direction', filterDirection);
      if (filterResult) params.set('result', filterResult);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));

      const data = await apiGet<{ trades: Trade[]; total: number }>(`/trades?${params}`);
      setTrades(data.trades);
      setTotal(data.total);
    } catch (_e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterSymbol, filterDirection, filterResult, page]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol || !form.entry || !form.stop_loss || !form.take_profit || !form.quantity || !form.profit_loss) {
      setError('Please fill in all required fields');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const payload = {
        ...form,
        entry: parseFloat(form.entry),
        stop_loss: parseFloat(form.stop_loss),
        take_profit: parseFloat(form.take_profit),
        quantity: parseFloat(form.quantity),
        profit_loss: parseFloat(form.profit_loss),
      };
      if (editId !== null) {
        await apiPut(`/trades/${editId}`, payload);
      } else {
        await apiPost('/trades', payload);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      load();
    } catch (_e) {
      setError('Failed to save trade');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (trade: Trade) => {
    setForm({
      date: trade.date,
      time: trade.time,
      symbol: trade.symbol,
      direction: trade.direction,
      entry: String(trade.entry),
      stop_loss: String(trade.stop_loss),
      take_profit: String(trade.take_profit),
      quantity: String(trade.quantity),
      result: trade.result,
      profit_loss: String(trade.profit_loss),
      notes: trade.notes,
    });
    setEditId(trade.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this trade?')) return;
    try {
      await apiDelete(`/trades/${id}`);
      load();
    } catch (_e) {}
  };

  const inputStyle: React.CSSProperties = {
    background: '#121212',
    border: '1px solid #3A3A3A',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 13,
    padding: '8px 10px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: '#B0B0B0',
    fontSize: 11,
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>Trade Journal</h1>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>{total} total trades</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true); }}
          style={{ background: '#2979FF', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '10px 20px', fontSize: 14, fontWeight: 700 }}
        >
          + Add Trade
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#1E1E1E', borderRadius: 16, padding: 24, width: '100%', maxWidth: 700, border: '1px solid #3A3A3A', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              {editId !== null ? 'Edit Trade' : 'Add Trade'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Time *</label>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Symbol *</label>
                  <input type="text" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} style={inputStyle} placeholder="EURUSD" required />
                </div>
                <div>
                  <label style={labelStyle}>Direction *</label>
                  <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value as 'BUY' | 'SELL' }))} style={inputStyle}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Entry Price *</label>
                  <input type="number" value={form.entry} onChange={e => setForm(f => ({ ...f, entry: e.target.value }))} style={inputStyle} step="any" required />
                </div>
                <div>
                  <label style={labelStyle}>Stop Loss *</label>
                  <input type="number" value={form.stop_loss} onChange={e => setForm(f => ({ ...f, stop_loss: e.target.value }))} style={inputStyle} step="any" required />
                </div>
                <div>
                  <label style={labelStyle}>Take Profit *</label>
                  <input type="number" value={form.take_profit} onChange={e => setForm(f => ({ ...f, take_profit: e.target.value }))} style={inputStyle} step="any" required />
                </div>
                <div>
                  <label style={labelStyle}>Quantity *</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} step="any" required />
                </div>
                <div>
                  <label style={labelStyle}>Result *</label>
                  <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value as 'WIN' | 'LOSS' | 'BE' }))} style={inputStyle}>
                    <option value="WIN">WIN</option>
                    <option value="LOSS">LOSS</option>
                    <option value="BE">BREAK EVEN</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Profit / Loss ($) *</label>
                  <input
                    type="number"
                    value={form.profit_loss}
                    onChange={e => setForm(f => ({ ...f, profit_loss: e.target.value }))}
                    style={inputStyle}
                    step="0.01"
                    placeholder="e.g. -5.00 or 10.00"
                    required
                  />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ ...inputStyle, height: 70, resize: 'vertical' }}
                    placeholder="Trade notes, setup, lessons learned..."
                  />
                </div>
              </div>
              {error && <p style={{ color: '#FF1744', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={primaryBtn}>
                  {saving ? 'Saving...' : editId !== null ? 'Update Trade' : 'Add Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 16, border: '1px solid #2A2A2A', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(0); }} style={{ ...inputStyle, width: 150 }} />
          </div>
          <div>
            <label style={labelStyle}>Symbol</label>
            <input type="text" value={filterSymbol} onChange={e => { setFilterSymbol(e.target.value); setPage(0); }} style={{ ...inputStyle, width: 120 }} placeholder="e.g. EURUSD" />
          </div>
          <div>
            <label style={labelStyle}>Direction</label>
            <select value={filterDirection} onChange={e => { setFilterDirection(e.target.value); setPage(0); }} style={{ ...inputStyle, width: 120 }}>
              <option value="">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Result</label>
            <select value={filterResult} onChange={e => { setFilterResult(e.target.value); setPage(0); }} style={{ ...inputStyle, width: 120 }}>
              <option value="">All</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
              <option value="BE">BREAK EVEN</option>
            </select>
          </div>
          <button
            onClick={() => { setFilterDate(''); setFilterSymbol(''); setFilterDirection(''); setFilterResult(''); setPage(0); }}
            style={ghostBtn}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#1E1E1E', borderRadius: 12, border: '1px solid #2A2A2A', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#252525', borderBottom: '1px solid #2A2A2A' }}>
                {['Date', 'Time', 'Symbol', 'Dir', 'Entry', 'SL', 'TP', 'Qty', 'Result', 'P&L', 'Notes', ''].map(h => (
                  <th key={h} style={{ color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: '#666' }}>No trades found. Add your first trade!</td></tr>
              ) : trades.map(trade => (
                <tr
                  key={trade.id}
                  style={{ borderBottom: '1px solid #252525', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle}>{trade.date}</td>
                  <td style={tdStyle}>{trade.time}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#FFFFFF' }}>{trade.symbol}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: trade.direction === 'BUY' ? '#00C85320' : '#FF174420',
                      color: trade.direction === 'BUY' ? '#00C853' : '#FF1744',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>{trade.direction}</span>
                  </td>
                  <td style={tdStyle}>{trade.entry}</td>
                  <td style={{ ...tdStyle, color: '#FF1744' }}>{trade.stop_loss}</td>
                  <td style={{ ...tdStyle, color: '#00C853' }}>{trade.take_profit}</td>
                  <td style={tdStyle}>{trade.quantity}</td>
                  <td style={tdStyle}>
                    <ResultBadge result={trade.result} />
                  </td>
                  <td style={{ ...tdStyle, color: trade.profit_loss >= 0 ? '#00C853' : '#FF1744', fontWeight: 700, fontFamily: 'monospace' }}>
                    {trade.profit_loss >= 0 ? '+' : ''}{formatCurrency(trade.profit_loss)}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#888' }}>{trade.notes}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEdit(trade)} style={iconBtn} title="Edit">✏️</button>
                    <button onClick={() => handleDelete(trade.id)} style={{ ...iconBtn, color: '#FF1744' }} title="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #2A2A2A' }}>
            <span style={{ color: '#666', fontSize: 13 }}>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={ghostBtn}>← Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total} style={ghostBtn}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ResultBadge: React.FC<{ result: string }> = ({ result }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    WIN: { bg: '#00C85320', text: '#00C853' },
    LOSS: { bg: '#FF174420', text: '#FF1744' },
    BE: { bg: '#FFD60020', text: '#FFD600' },
  };
  const c = colors[result] ?? colors.BE;
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {result}
    </span>
  );
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#B0B0B0',
  fontSize: 13,
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 6px',
  fontSize: 14,
  borderRadius: 4,
};

const primaryBtn: React.CSSProperties = {
  background: '#2979FF',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 700,
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #3A3A3A',
  borderRadius: 8,
  color: '#B0B0B0',
  cursor: 'pointer',
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
};

export default Journal;
