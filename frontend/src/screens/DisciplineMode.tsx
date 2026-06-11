import React, { useState, useEffect } from 'react';
import { Settings, DailySummary } from '../types';
import { apiGet, apiPut } from '../hooks/useApi';
import { formatCurrency } from '../utils/calculations';

const DisciplineMode: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    balance: '470',
    daily_target: '50',
    daily_loss_limit: '10',
    risk_per_trade: '5',
    max_trades_per_day: '4',
    max_consecutive_losses: '2',
    min_rr_ratio: '2',
    discipline_mode_enabled: 'true',
  });
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...settings });

  const load = async () => {
    try {
      setLoading(true);
      const [s, d] = await Promise.all([
        apiGet<Settings>('/settings'),
        apiGet<DailySummary>('/settings/daily-summary'),
      ]);
      setSettings(s);
      setForm(s);
      setDaily(d);
    } catch (_e) {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      setSaving(true);
      await apiPut('/settings', form);
      setSettings({ ...form });
      setEditMode(false);
      setSaveMsg('Settings saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (_e) {
      setSaveMsg('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
      <p>Loading...</p>
    </div>
  );

  const dailyTarget = parseFloat(settings.daily_target);
  const dailyLossLimit = parseFloat(settings.daily_loss_limit);
  const maxTrades = parseInt(settings.max_trades_per_day);
  const maxConsecLosses = parseInt(settings.max_consecutive_losses);
  const disciplineEnabled = settings.discipline_mode_enabled === 'true';

  const pnl = daily?.totalPnl ?? 0;
  const trades = daily?.totalTrades ?? 0;
  const consecLosses = daily?.consecutiveLosses ?? 0;

  const targetHit = pnl >= dailyTarget;
  const lossLimitHit = pnl <= -dailyLossLimit;
  const tradesMax = trades >= maxTrades;
  const consecLossMax = consecLosses >= maxConsecLosses;

  const shouldStop = disciplineEnabled && (targetHit || lossLimitHit || tradesMax || consecLossMax);
  const canTrade = !shouldStop;

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border-2)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 14,
    padding: '10px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-dim)',
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 6,
    display: 'block',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, margin: 0 }}>Discipline Mode</h1>
        <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>Automated trading limits and discipline enforcement</p>
      </div>

      {/* Big Status Banner */}
      <div style={{
        borderRadius: 16,
        padding: '32px 40px',
        marginBottom: 24,
        textAlign: 'center',
        background: shouldStop ? '#FF174415' : canTrade ? '#00C85315' : 'var(--surface)',
        border: `2px solid ${shouldStop ? '#FF1744' : '#00C853'}`,
        transition: 'all 0.3s',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>
          {shouldStop ? '🚫' : !disciplineEnabled ? '⚠️' : '✅'}
        </div>
        <div style={{
          fontSize: 28,
          fontWeight: 900,
          color: shouldStop ? '#FF1744' : !disciplineEnabled ? '#FFD600' : '#00C853',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          {shouldStop
            ? 'STOP TRADING FOR TODAY'
            : !disciplineEnabled
            ? 'DISCIPLINE MODE DISABLED'
            : 'CLEAR TO TRADE'}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          {shouldStop && targetHit && 'Daily profit target has been reached.'}
          {shouldStop && lossLimitHit && 'Daily loss limit has been hit.'}
          {shouldStop && tradesMax && !lossLimitHit && !targetHit && 'Maximum daily trades used.'}
          {shouldStop && consecLossMax && !tradesMax && !lossLimitHit && !targetHit && 'Maximum consecutive losses reached.'}
          {!shouldStop && disciplineEnabled && 'You are within your risk parameters.'}
          {!disciplineEnabled && 'Enable discipline mode for automated stop protection.'}
        </div>
      </div>

      {/* Lock Conditions */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', marginBottom: 24 }}>
        <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Lock Conditions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <ConditionCard
            label="Daily Profit Target"
            current={Math.max(0, pnl)}
            target={dailyTarget}
            unit="$"
            triggered={targetHit}
            triggerLabel="Target Reached"
          />
          <ConditionCard
            label="Daily Loss Limit"
            current={Math.abs(Math.min(0, pnl))}
            target={dailyLossLimit}
            unit="$"
            triggered={lossLimitHit}
            triggerLabel="Limit Hit"
          />
          <ConditionCard
            label="Max Trades / Day"
            current={trades}
            target={maxTrades}
            unit=""
            triggered={tradesMax}
            triggerLabel="Max Reached"
          />
          <ConditionCard
            label="Consecutive Losses"
            current={consecLosses}
            target={maxConsecLosses}
            unit=""
            triggered={consecLossMax}
            triggerLabel="Max Reached"
          />
        </div>
      </div>

      {/* Today's Stats */}
      {daily && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', marginBottom: 24 }}>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Today's Activity</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <MiniStat label="Total PnL" value={`${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`} color={pnl >= 0 ? '#00C853' : '#FF1744'} />
            <MiniStat label="Trades Today" value={`${trades}/${maxTrades}`} color={tradesMax ? '#FF1744' : 'var(--text)'} />
            <MiniStat label="Today Wins" value={String(daily.wins)} color="#00C853" />
            <MiniStat label="Today Losses" value={String(daily.losses)} color="#FF1744" />
            <MiniStat label="Consec. Losses" value={String(consecLosses)} color={consecLossMax ? '#FF1744' : 'var(--text)'} />
          </div>
        </div>
      )}

      {/* Settings */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0 }}>Risk Profile Settings</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {saveMsg && <span style={{ color: '#00C853', fontSize: 13, alignSelf: 'center' }}>{saveMsg}</span>}
            {editMode ? (
              <>
                <button onClick={() => { setEditMode(false); setForm({ ...settings }); }} style={ghostBtn}>Cancel</button>
                <button onClick={save} disabled={saving} style={primaryBtn}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} style={primaryBtn}>Edit</button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {editMode ? (
            <>
              <FormField label="Account Balance ($)" value={form.balance} onChange={v => setForm(f => ({ ...f, balance: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <FormField label="Daily Target ($)" value={form.daily_target} onChange={v => setForm(f => ({ ...f, daily_target: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <FormField label="Daily Loss Limit ($)" value={form.daily_loss_limit} onChange={v => setForm(f => ({ ...f, daily_loss_limit: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <FormField label="Risk Per Trade ($)" value={form.risk_per_trade} onChange={v => setForm(f => ({ ...f, risk_per_trade: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <FormField label="Max Trades / Day" value={form.max_trades_per_day} onChange={v => setForm(f => ({ ...f, max_trades_per_day: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <FormField label="Max Consecutive Losses" value={form.max_consecutive_losses} onChange={v => setForm(f => ({ ...f, max_consecutive_losses: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <FormField label="Min RR Ratio" value={form.min_rr_ratio} onChange={v => setForm(f => ({ ...f, min_rr_ratio: v }))} inputStyle={inputStyle} labelStyle={labelStyle} />
              <div>
                <label style={labelStyle}>Discipline Mode</label>
                <select
                  value={form.discipline_mode_enabled}
                  onChange={e => setForm(f => ({ ...f, discipline_mode_enabled: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <SettingDisplay label="Account Balance" value={formatCurrency(parseFloat(settings.balance))} />
              <SettingDisplay label="Daily Target" value={formatCurrency(parseFloat(settings.daily_target))} color="#00C853" />
              <SettingDisplay label="Daily Loss Limit" value={formatCurrency(parseFloat(settings.daily_loss_limit))} color="#FF1744" />
              <SettingDisplay label="Risk Per Trade" value={formatCurrency(parseFloat(settings.risk_per_trade))} />
              <SettingDisplay label="Max Trades / Day" value={settings.max_trades_per_day} />
              <SettingDisplay label="Max Consec. Losses" value={settings.max_consecutive_losses} />
              <SettingDisplay label="Min RR Ratio" value={`${settings.min_rr_ratio}:1`} />
              <SettingDisplay
                label="Discipline Mode"
                value={disciplineEnabled ? 'Enabled' : 'Disabled'}
                color={disciplineEnabled ? '#00C853' : '#FFD600'}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ConditionCard: React.FC<{
  label: string;
  current: number;
  target: number;
  unit: string;
  triggered: boolean;
  triggerLabel: string;
}> = ({ label, current, target, unit, triggered, triggerLabel }) => {
  const progress = Math.min((current / target) * 100, 100);
  const color = triggered ? '#FF1744' : progress > 75 ? '#FFD600' : '#00C853';

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14, border: `1px solid ${triggered ? '#FF174440' : 'var(--border)'}` }}>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: 18 }}>
          {unit}{current.toFixed(2)}
        </span>
        <span style={{ color: '#555', fontSize: 12 }}>/ {unit}{target}</span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ background: color, height: '100%', width: `${progress}%`, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      {triggered && (
        <div style={{ color: '#FF1744', fontSize: 11, fontWeight: 700 }}>{triggerLabel}</div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
    <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontWeight: 700, fontSize: 18, fontFamily: 'monospace' }}>{value}</div>
  </div>
);

const SettingDisplay: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'var(--text)' }) => (
  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
    <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{value}</div>
  </div>
);

const FormField: React.FC<{ label: string; value: string; onChange: (v: string) => void; inputStyle: React.CSSProperties; labelStyle: React.CSSProperties }> = ({ label, value, onChange, inputStyle, labelStyle }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input type="number" value={value} onChange={e => onChange(e.target.value)} style={inputStyle} step="any" />
  </div>
);

const primaryBtn: React.CSSProperties = {
  background: '#2979FF',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-2)',
  borderRadius: 8,
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
};

export default DisciplineMode;
