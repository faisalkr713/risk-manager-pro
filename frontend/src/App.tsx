import React, { useState, useEffect, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './screens/Dashboard';
import Calculator from './screens/Calculator';
import DisciplineMode from './screens/DisciplineMode';
import Journal from './screens/Journal';
import Statistics from './screens/Statistics';
import BrokerProfiles from './screens/BrokerProfiles';
import AssetManager from './screens/AssetManager';
import ScreenshotAnalyzer from './screens/ScreenshotAnalyzer';
import Upgrade from './screens/Upgrade';
import Auth from './screens/Auth';
import { Screen } from './types';
import { NAV_ITEMS, API_BASE } from './constants';
import { usePlan, PlanStatus } from './hooks/usePlan';

interface AuthUser { id: number; email: string; name: string; created_at: string; }

// Plan context — any screen can read plan status
export const PlanContext = createContext<ReturnType<typeof usePlan> | null>(null);
export function usePlanContext() { return useContext(PlanContext)!; }

// Global event: "profitable trade logged" → show coffee popup
export function notifyProfitableTrade() {
  window.dispatchEvent(new CustomEvent('rmp:profitable_trade'));
}

const renderScreen = (s: Screen, onUpgrade: () => void) => {
  switch (s) {
    case 'dashboard':  return <Dashboard />;
    case 'calculator': return <Calculator />;
    case 'discipline': return <DisciplineMode />;
    case 'journal':    return <Journal onUpgrade={onUpgrade} />;
    case 'statistics': return <Statistics />;
    case 'brokers':    return <BrokerProfiles />;
    case 'assets':     return <AssetManager />;
    case 'screenshot': return <ScreenshotAnalyzer onUpgrade={onUpgrade} />;
    case 'upgrade':    return <Upgrade />;
    default:           return <Dashboard />;
  }
};

const App: React.FC = () => {
  const [active, setActive]       = useState<Screen>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showCoffee, setShowCoffee]   = useState(false);
  const planData = usePlan();

  useEffect(() => {
    const token = localStorage.getItem('rmp_token');
    if (!token) { setAuthChecked(true); return; }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUser(data.user); })
      .catch(() => { localStorage.removeItem('rmp_token'); })
      .finally(() => setAuthChecked(true));
  }, []);

  // Listen for profitable trade event → show coffee popup
  useEffect(() => {
    const handler = () => setShowCoffee(true);
    window.addEventListener('rmp:profitable_trade', handler);
    return () => window.removeEventListener('rmp:profitable_trade', handler);
  }, []);

  // Check URL params after Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === '1') {
      planData.refresh();
      window.history.replaceState({}, '', '/');
      setActive('upgrade');
    }
  }, []);

  const handleAuth = (token: string, u: AuthUser) => {
    localStorage.setItem('rmp_token', token);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('rmp_token');
    setUser(null);
  };

  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D0D0D' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #1e1e1e', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!user) return <Auth onAuth={handleAuth} />;

  return (
    <PlanContext.Provider value={planData}>
      <div className="app-shell">
        <Sidebar
          active={active}
          onNavigate={setActive}
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          user={user}
          onLogout={handleLogout}
          isPro={planData.isPro}
          tradesLeft={planData.tradesLeft}
        />

        <main className="main-content">
          {renderScreen(active, () => setActive('upgrade'))}
        </main>

        <nav className="bottom-nav">
          <div className="bottom-nav-scroll">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`bottom-nav-btn${active === item.id ? ' active' : ''}`}
                onClick={() => setActive(item.id as Screen)}
              >
                <span className="bn-icon">{item.icon}</span>
                <span>{item.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Buy Me a Coffee popup after profitable trade */}
        {showCoffee && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setShowCoffee(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: 20,
              padding: 32, maxWidth: 400, width: '90%', textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>☕</div>
              <h2 style={{ color: '#fff', margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>You closed a winning trade!</h2>
              <p style={{ color: '#888', margin: '0 0 24px', fontSize: 14, lineHeight: 1.6 }}>
                Nice profit! If Risk Manager Pro helped you stay disciplined, consider buying me a coffee. ☕
              </p>
              <a
                href={planData.status?.donationUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', padding: '14px', background: '#FFDD00', borderRadius: 12, color: '#333', fontWeight: 800, fontSize: 15, textDecoration: 'none', marginBottom: 12 }}
              >
                ☕ Buy Me a Coffee — $5
              </a>
              <button onClick={() => setShowCoffee(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13 }}>
                Maybe later
              </button>
            </div>
          </div>
        )}
      </div>
    </PlanContext.Provider>
  );
};

export default App;
