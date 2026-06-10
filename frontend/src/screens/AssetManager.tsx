import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi';
import { ASSET_TYPES } from '../constants';

interface AssetForm {
  symbol: string;
  asset_type: string;
  contract_size: string;
  tick_size: string;
  tick_value: string;
  currency: string;
  leverage: string;
}

const emptyForm = (): AssetForm => ({
  symbol: '',
  asset_type: 'Forex',
  contract_size: '100000',
  tick_size: '0.0001',
  tick_value: '10',
  currency: 'USD',
  leverage: '100',
});

const AssetManager: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet<Asset[]>('/assets');
      setAssets(data);
    } catch (_e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol) { setError('Symbol is required'); return; }
    try {
      setSaving(true);
      setError('');
      const payload = {
        ...form,
        contract_size: parseFloat(form.contract_size),
        tick_size: parseFloat(form.tick_size),
        tick_value: parseFloat(form.tick_value),
        leverage: parseInt(form.leverage),
      };
      if (editId !== null) {
        await apiPut(`/assets/${editId}`, payload);
      } else {
        await apiPost('/assets', payload);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      load();
    } catch (_e) {
      setError('Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (asset: Asset) => {
    setForm({
      symbol: asset.symbol,
      asset_type: asset.asset_type,
      contract_size: String(asset.contract_size),
      tick_size: String(asset.tick_size),
      tick_value: String(asset.tick_value),
      currency: asset.currency,
      leverage: String(asset.leverage),
    });
    setEditId(asset.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this asset?')) return;
    try {
      await apiDelete(`/assets/${id}`);
      load();
    } catch (_e) {}
  };

  const filtered = assets.filter(a =>
    a.symbol.toLowerCase().includes(search.toLowerCase()) ||
    a.asset_type.toLowerCase().includes(search.toLowerCase())
  );

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

  const typeColors: Record<string, string> = {
    Forex: '#2979FF',
    Crypto: '#FFD600',
    Stocks: '#00C853',
    Futures: '#FF6D00',
    Indices: '#AA00FF',
    Commodities: '#00BFA5',
    Metals: '#C6A700',
    Custom: '#FF1744',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>Asset Manager</h1>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>Create and manage custom trading instruments</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true); }}
          style={primaryBtn}
        >
          + Add Asset
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1E1E1E', borderRadius: 16, padding: 24, width: '100%', maxWidth: 580, border: '1px solid #3A3A3A' }}>
            <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              {editId !== null ? 'Edit Asset' : 'Add Custom Asset'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Symbol *</label>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    style={inputStyle}
                    placeholder="EURUSD"
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Asset Type *</label>
                  <select value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))} style={inputStyle}>
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Contract Size</label>
                  <input type="number" value={form.contract_size} onChange={e => setForm(f => ({ ...f, contract_size: e.target.value }))} style={inputStyle} step="any" />
                </div>
                <div>
                  <label style={labelStyle}>Tick Size</label>
                  <input type="number" value={form.tick_size} onChange={e => setForm(f => ({ ...f, tick_size: e.target.value }))} style={inputStyle} step="any" />
                </div>
                <div>
                  <label style={labelStyle}>Tick Value ($)</label>
                  <input type="number" value={form.tick_value} onChange={e => setForm(f => ({ ...f, tick_value: e.target.value }))} style={inputStyle} step="any" />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <input type="text" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} style={inputStyle} placeholder="USD" />
                </div>
                <div>
                  <label style={labelStyle}>Leverage</label>
                  <input type="number" value={form.leverage} onChange={e => setForm(f => ({ ...f, leverage: e.target.value }))} style={inputStyle} min="1" />
                </div>
              </div>
              {error && <p style={{ color: '#FF1744', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={primaryBtn}>
                  {saving ? 'Saving...' : editId !== null ? 'Update' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search symbols or asset types..."
          style={{
            background: '#1E1E1E',
            border: '1px solid #3A3A3A',
            borderRadius: 8,
            color: '#FFFFFF',
            fontSize: 14,
            padding: '10px 14px',
            width: '100%',
            maxWidth: 350,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#B0B0B0' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 60, border: '1px dashed #2A2A2A', textAlign: 'center', color: '#555' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <p>{search ? 'No assets match your search.' : 'No custom assets yet. Add your first instrument!'}</p>
        </div>
      ) : (
        <div style={{ background: '#1E1E1E', borderRadius: 12, border: '1px solid #2A2A2A', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#252525', borderBottom: '1px solid #2A2A2A' }}>
                  {['Symbol', 'Type', 'Contract Size', 'Tick Size', 'Tick Value', 'Currency', 'Leverage', ''].map(h => (
                    <th key={h} style={{ color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => (
                  <tr
                    key={asset.id}
                    style={{ borderBottom: '1px solid #252525', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#FFFFFF', fontSize: 15 }}>{asset.symbol}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: `${typeColors[asset.asset_type] ?? '#2979FF'}20`,
                        color: typeColors[asset.asset_type] ?? '#2979FF',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {asset.asset_type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{asset.contract_size.toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{asset.tick_size}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>${asset.tick_value}</td>
                    <td style={tdStyle}>{asset.currency}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>1:{asset.leverage}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleEdit(asset)} style={iconBtn} title="Edit">✏️</button>
                      <button onClick={() => handleDelete(asset.id)} style={{ ...iconBtn, color: '#FF1744' }} title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid #2A2A2A', color: '#555', fontSize: 12 }}>
            {filtered.length} asset{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

const tdStyle: React.CSSProperties = { padding: '10px 14px', color: '#B0B0B0', fontSize: 13 };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 14, borderRadius: 4 };
const primaryBtn: React.CSSProperties = { background: '#2979FF', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '10px 20px', fontSize: 14, fontWeight: 700 };
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #3A3A3A', borderRadius: 8, color: '#B0B0B0', cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: 600 };

export default AssetManager;
