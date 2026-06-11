import React, { useEffect, useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import { API_BASE } from '../constants';

const Upgrade: React.FC = () => {
  const { status, isPro, tradesLeft, analysesLeft, startCheckout, openPortal } = usePlan();
  const [qrUrl, setQrUrl] = useState<string>('');
  const donationUrl = status?.donationUrl ?? '';

  useEffect(() => {
    if (donationUrl) {
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(donationUrl)}&size=180x180&bgcolor=1E1E1E&color=FFFFFF&margin=10`);
    }
  }, [donationUrl]);

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <h1 style={{ color: 'var(--text)', fontSize: 32, fontWeight: 800, margin: 0 }}>
          {isPro ? 'You\'re on Pro!' : 'Upgrade to Pro'}
        </h1>
        <p style={{ color: '#888', fontSize: 15, marginTop: 8 }}>
          {isPro ? 'You have full access to all features.' : 'Unlock unlimited trades, AI analysis, and more.'}
        </p>
      </div>

      {/* Current usage (free users) */}
      {!isPro && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h3 style={{ color: 'var(--text)', margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>This Month's Usage</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <UsageBar label="Trade Records" used={status?.monthlyTrades ?? 0} limit={30} color="#2979FF" />
            <UsageBar label="Screenshot Analyses" used={status?.monthlyAnalyses ?? 0} limit={1} color="#9C27B0" />
          </div>
        </div>
      )}

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        {/* Free */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <div style={{ color: '#888', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Free</div>
          <div style={{ color: 'var(--text)', fontSize: 36, fontWeight: 800, marginBottom: 4 }}>$0</div>
          <div style={{ color: '#555', fontSize: 13, marginBottom: 24 }}>Forever free</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              '30 trade records / month',
              '1 screenshot analysis / month',
              'Risk calculator',
              'Basic dashboard',
              'Discipline mode',
            ].map(f => <FeatureItem key={f} text={f} included={true} />)}
            {['Unlimited trades', 'Unlimited AI analysis'].map(f => <FeatureItem key={f} text={f} included={false} />)}
          </ul>
          {!isPro && <div style={{ marginTop: 24, textAlign: 'center', color: '#555', fontSize: 13, fontWeight: 600 }}>Current Plan</div>}
        </div>

        {/* Pro */}
        <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1a1035 100%)', border: '2px solid #2979FF', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 16, right: 16, background: '#2979FF', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20, letterSpacing: '0.05em' }}>BEST VALUE</div>
          <div style={{ color: '#2979FF', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Pro</div>
          <div style={{ color: '#fff', fontSize: 36, fontWeight: 800, marginBottom: 4 }}>$20<span style={{ fontSize: 16, color: '#888', fontWeight: 400 }}>/month</span></div>
          <div style={{ color: '#555', fontSize: 13, marginBottom: 24 }}>Cancel anytime</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Unlimited trade records',
              'Unlimited AI screenshot analysis',
              'Full analytics & statistics',
              'CSV export',
              'Priority support',
              'All future features',
            ].map(f => <FeatureItem key={f} text={f} included={true} pro={true} />)}
          </ul>
          <div style={{ marginTop: 24 }}>
            {isPro ? (
              <div>
                <div style={{ textAlign: 'center', color: '#00C853', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✓ Active Subscription</div>
                <button onClick={openPortal} style={ghostBtn}>Manage Subscription</button>
              </div>
            ) : (
              <button onClick={startCheckout} style={upgradeBtn}>Upgrade Now →</button>
            )}
          </div>
        </div>
      </div>

      {/* Buy Me a Coffee */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, display: 'flex', gap: 32, alignItems: 'center' }}>
        <div style={{ flexShrink: 0 }}>
          {qrUrl ? (
            <img src={qrUrl} alt="Donation QR" style={{ width: 160, height: 160, borderRadius: 12, display: 'block', background: '#fff', padding: 4 }} />
          ) : (
            <div style={{ width: 160, height: 160, background: 'var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>QR Loading...</div>
          )}
          <div style={{ textAlign: 'center', color: '#555', fontSize: 11, marginTop: 8 }}>Scan to donate</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>☕</div>
          <h3 style={{ color: 'var(--text)', margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Buy Me a Coffee</h3>
          <p style={{ color: '#888', margin: '0 0 16px', fontSize: 14, lineHeight: 1.6 }}>
            Enjoying Risk Manager Pro? A small donation keeps the app running and helps add new features. Every coffee counts!
          </p>
          <a href={donationUrl || '#'} target="_blank" rel="noreferrer" style={{ ...coffeeBtn, textDecoration: 'none', display: 'inline-block' }}>
            ☕ Buy Me a Coffee — $5
          </a>
        </div>
      </div>
    </div>
  );
};

const UsageBar: React.FC<{ label: string; used: number; limit: number; color: string }> = ({ label, used, limit, color }) => {
  const pct = Math.min(100, (used / limit) * 100);
  const isNear = pct >= 80;
  const isMax = pct >= 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#888', fontSize: 13 }}>{label}</span>
        <span style={{ color: isMax ? '#FF1744' : isNear ? '#FFD600' : 'var(--text)', fontSize: 13, fontWeight: 700 }}>
          {used}/{limit}
        </span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: isMax ? '#FF1744' : isNear ? '#FFD600' : color, borderRadius: 6, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
};

const FeatureItem: React.FC<{ text: string; included: boolean; pro?: boolean }> = ({ text, included, pro }) => (
  <li style={{ display: 'flex', alignItems: 'center', gap: 10, color: included ? (pro ? '#fff' : 'var(--text-dim)') : '#444', fontSize: 14 }}>
    <span style={{ color: included ? (pro ? '#2979FF' : '#00C853') : '#333', fontSize: 16, flexShrink: 0 }}>
      {included ? '✓' : '✗'}
    </span>
    {text}
  </li>
);

const upgradeBtn: React.CSSProperties = {
  width: '100%', padding: '14px', background: '#2979FF', border: 'none', borderRadius: 10,
  color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.02em',
};
const ghostBtn: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'transparent', border: '1px solid #2979FF',
  borderRadius: 10, color: '#2979FF', fontSize: 14, fontWeight: 700, cursor: 'pointer',
};
const coffeeBtn: React.CSSProperties = {
  padding: '12px 24px', background: '#FFDD00', border: 'none', borderRadius: 10,
  color: '#333', fontSize: 15, fontWeight: 800, cursor: 'pointer',
};

export default Upgrade;
