import React, { useState, useEffect } from 'react';
import { Broker } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi';

interface BrokerForm {
  name: string;
  asset_class: string;
  contract_size: string;
  tick_value: string;
  tick_size: string;
  leverage: string;
  commission: string;
  lot_step: string;
}

const emptyForm = (): BrokerForm => ({
  name: '',
  asset_class: 'Forex',
  contract_size: '100000',
  tick_value: '10',
  tick_size: '0.0001',
  leverage: '100',
  commission: '0',
  lot_step: '0.01',
});

const ASSET_CLASSES = ['Forex', 'Crypto', 'Stocks', 'Futures', 'Indices', 'Commodities', 'Metals', 'Custom'];

const BrokerProfiles: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BrokerForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet<Broker[]>('/brokers');
      setBrokers(data);
    } catch (_e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required'); return; }
    try {
      setSaving(true);
      setError('');
      const payload = {
        ...form,
        contract_size: parseFloat(form.contract_size),
        tick_value: parseFloat(form.tick_value),
        tick_size: parseFloat(form.tick_size),
        leverage: parseInt(form.leverage),
        commission: parseFloat(form.commission),
        lot_step: parseFloat(form.lot_step),
      };
      if (editId !== null) {
        await apiPut(`/brokers/${editId}`, payload);
      } else {
        await apiPost('/brokers', payload);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      load();
    } catch (_e) {
      setError('Failed to save broker');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (broker: Broker) => {
    setForm({
      name: broker.name,
      asset_class: broker.asset_class,
      contract_size: String(broker.contract_size),
      tick_value: String(broker.tick_value),
      tick_size: String(broker.tick_size),
      leverage: String(broker.leverage),
      commission: String(broker.commission),
      lot_step: String(broker.lot_step),
    });
    setEditId(broker.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this broker profile?')) return;
    try {
      await apiDelete(`/brokers/${id}`);
      if (selectedBroker?.id === id) setSelectedBroker(null);
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

  const defaultBrokers = brokers.filter(b => b.is_custom === 0);
  const customBrokers = brokers.filter(b => b.is_custom === 1);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>Broker Profiles</h1>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>Contract specifications for accurate position sizing</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true); }}
          style={primaryBtn}
        >
          + Add Broker
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1E1E1E', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, border: '1px solid #3A3A3A' }}>
            <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              {editId !== null ? 'Edit Broker' : 'Add Custom Broker'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Broker Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="My Broker" required />
                </div>
                <div>
                  <label style={labelStyle}>Asset Class</label>
                  <select value={form.asset_class} onChange={e => setForm(f => ({ ...f, asset_class: e.target.value }))} style={inputStyle}>
                    {ASSET_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
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
                  <label style={labelStyle}>Leverage</label>
                  <input type="number" value={form.leverage} onChange={e => setForm(f => ({ ...f, leverage: e.target.value }))} style={inputStyle} min="1" />
                </div>
                <div>
                  <label style={labelStyle}>Commission ($/lot)</label>
                  <input type="number" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} style={inputStyle} step="any" />
                </div>
                <div>
                  <label style={labelStyle}>Lot Step</label>
                  <input type="number" value={form.lot_step} onChange={e => setForm(f => ({ ...f, lot_step: e.target.value }))} style={inputStyle} step="any" />
                </div>
              </div>
              {error && <p style={{ color: '#FF1744', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={primaryBtn}>{saving ? 'Saving...' : editId !== null ? 'Update' : 'Add Broker'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#B0B0B0' }}>Loading...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedBroker ? '1fr 320px' : '1fr', gap: 20 }}>
          <div>
            {/* Default Brokers */}
            <SectionLabel>Pre-configured Brokers</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
              {defaultBrokers.map(broker => (
                <BrokerCard
                  key={broker.id}
                  broker={broker}
                  selected={selectedBroker?.id === broker.id}
                  onSelect={() => setSelectedBroker(selectedBroker?.id === broker.id ? null : broker)}
                  onEdit={() => handleEdit(broker)}
                  onDelete={() => handleDelete(broker.id)}
                />
              ))}
            </div>

            {/* Custom Brokers */}
            <SectionLabel>Custom Brokers {customBrokers.length > 0 ? `(${customBrokers.length})` : ''}</SectionLabel>
            {customBrokers.length === 0 ? (
              <div style={{ background: '#1E1E1E', borderRadius: 10, padding: 24, border: '1px dashed #2A2A2A', textAlign: 'center', color: '#555' }}>
                No custom brokers yet. Click "+ Add Broker" to create one.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {customBrokers.map(broker => (
                  <BrokerCard
                    key={broker.id}
                    broker={broker}
                    selected={selectedBroker?.id === broker.id}
                    onSelect={() => setSelectedBroker(selectedBroker?.id === broker.id ? null : broker)}
                    onEdit={() => handleEdit(broker)}
                    onDelete={() => handleDelete(broker.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedBroker && (
            <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 20, border: '1px solid #2979FF40', height: 'fit-content', position: 'sticky', top: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, margin: 0 }}>{selectedBroker.name}</h3>
                  <span style={{ background: '#2979FF20', color: '#2979FF', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    {selectedBroker.asset_class}
                  </span>
                </div>
                <button onClick={() => setSelectedBroker(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <DetailRow label="Contract Size" value={selectedBroker.contract_size.toLocaleString()} />
                <DetailRow label="Tick Size" value={String(selectedBroker.tick_size)} />
                <DetailRow label="Tick Value" value={`$${selectedBroker.tick_value}`} />
                <DetailRow label="Leverage" value={`1:${selectedBroker.leverage}`} />
                <DetailRow label="Commission" value={selectedBroker.commission === 0 ? 'Spread only' : `$${selectedBroker.commission}/lot`} />
                <DetailRow label="Lot Step" value={String(selectedBroker.lot_step)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ color: '#B0B0B0', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>
    {children}
  </h2>
);

const BrokerCard: React.FC<{
  broker: Broker;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ broker, selected, onSelect, onEdit, onDelete }) => (
  <div
    onClick={onSelect}
    style={{
      background: selected ? '#1A2840' : '#1E1E1E',
      borderRadius: 10,
      padding: 16,
      border: `1px solid ${selected ? '#2979FF60' : '#2A2A2A'}`,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
      <div>
        <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15 }}>{broker.name}</div>
        <span style={{
          background: '#2979FF15',
          color: '#2979FF',
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 600,
          marginTop: 4,
          display: 'inline-block',
        }}>
          {broker.asset_class}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, padding: '2px 4px' }}
          title="Edit"
        >✏️</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, padding: '2px 4px' }}
          title="Delete"
        >🗑️</button>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <MiniDetail label="Leverage" value={`1:${broker.leverage}`} />
      <MiniDetail label="Commission" value={broker.commission === 0 ? 'Spread' : `$${broker.commission}`} />
    </div>
  </div>
);

const MiniDetail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ color: '#B0B0B0', fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{value}</div>
  </div>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #2A2A2A' }}>
    <span style={{ color: '#666', fontSize: 12 }}>{label}</span>
    <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

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

export default BrokerProfiles;
