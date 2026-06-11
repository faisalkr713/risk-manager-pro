import React, { useState, useEffect, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import CoffeeFab from './components/CoffeeFab';
import Dashboard from './screens/Dashboard';
import Calculator from './screens/Calculator';
import DisciplineMode from './screens/DisciplineMode';
import Journal from './screens/Journal';
import Statistics from './screens/Statistics';
import BrokerProfiles from './screens/BrokerProfiles';
import AssetManager from './screens/AssetManager';
import ScreenshotAnalyzer from './screens/ScreenshotAnalyzer';
import Upgrade from './screens/Upgrade';
import { Screen } from './types';
import { NAV_ITEMS, API_BASE } from './constants';
import { usePlan } from './hooks/usePlan';
import { useTheme } from './hooks/useTheme';

interface AuthUser { id: number; email: string; name: string; is_guest?: boolean; created_at: string; }

// Plan context — any screen can read plan status
export const PlanContext = createContext<ReturnType<typeof usePlan> | null>(null);
export function usePlanContext() { return useContext(PlanContext)!; }

// Global events
export function notifyProfitableTrade() {
  window.dispatchEvent(new CustomEvent('rmp:profitable_trade'));
}
export function notifyTradeAdded() {
  window.dispatchEvent(new CustomEvent('rmp:trade_added'));
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode]   = useState<'login' | 'signup'>('signup');
  const planData = usePlan();
  const { theme, toggle: toggleTheme } = useTheme();

  // ── Session bootstrap: never block the app behind a login wall ──
  useEffect(() => {
    let cancelled = false;
    async function createGuest() {
      try {
        const res = await fetch(`${API_BASE}/auth/guest`, { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        localStorage.setItem('rmp_token', data.token);
        setUser(data.user);
      } catch { /* offline — app still renders */ }
    }
    async function boot() {
      const token = localStorage.getItem('rmp_token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setUser(data.user);
          } else {
            localStorage.removeItem('rmp_token');
            await createGuest();
          }
        } catch { /* network */ }
      } else {
        await createGuest();
      }
      if (!cancelled) { setAuthChecked(true); planData.refresh(); }
    }
    boot();
    return () => { cancelled = true; };
  }, []);

  // Coffee popup after a profitable trade
  useEffect(() => {
    const handler = () => setShowCoffee(true);
    window.addEventListener('rmp:profitable_trade', handler);
    return () => window.removeEventListener('rmp:profitable_trade', handler);
  }, []);

  // Refresh plan usage whenever a trade is added
  useEffect(() => {
    const handler = () => planData.refresh();
    window.addEventListener('rmp:trade_added', handler);
    return () => window.removeEventListener('rmp:trade_added', handler);
  }, [planData]);

  // Nudge guests to sign up after they've logged 3 trades
  useEffect(() => {
    if (!user?.is_guest || !planData.status) return;
    if (planData.status.monthlyTrades >= 3 && !sessionStorage.getItem('rmp_nudge_dismissed') && !showAuthModal) {
      setAuthMode('signup');
      setShowAuthModal(true);
    }
  }, [planData.status?.monthlyTrades, user]);

  // Handle Stripe redirect
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
    setShowAuthModal(false);
    planData.refresh();
  };

  const handleLogout = () => {
    localStorage.removeItem('rmp_token');
    window.location.reload(); // fresh guest session
  };

  const openAuth = (mode: 'login' | 'signup') => { setAuthMode(mode); setShowAuthModal(true); };
  const continueGuest = () => { sessionStorage.setItem('rmp_nudge_dismissed', '1'); setShowAuthModal(false); };

  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }} className="boot-screen">
      <div style={{ width: 36, height: 36, border: '3px solid #1e1e1e', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const isGuest = !!user?.is_guest;

  return (
    <PlanContext.Provider value={planData}>
      <div className="app-shell">
        <Sidebar
          active={active}
          onNavigate={setActive}
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          user={user ?? { name: 'Guest', email: '' }}
          isGuest={isGuest}
          onLogout={handleLogout}
          onShowAuth={openAuth}
          isPro={planData.isPro}
          tradesLeft={planData.tradesLeft}
          theme={theme}
          onToggleTheme={toggleTheme}
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

        {/* Always-visible Buy Me a Coffee */}
        <CoffeeFab donationUrl={planData.status?.donationUrl ?? ''} />

        {/* Auth modal (signup nudge / login) */}
        {showAuthModal && (
          <AuthModal
            initialMode={authMode}
            onAuth={handleAuth}
            onClose={continueGuest}
            onContinueGuest={continueGuest}
          />
        )}

        {/* Coffee popup after a profitable trade */}
        {showCoffee && (
          <div className="modal-overlay" onClick={() => setShowCoffee(false)}>
            <div className="coffee-popup" onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>☕</div>
              <h2>You closed a winning trade! 🎉</h2>
              <p>
                If Trade Calculate helped you stay disciplined and your trading is in profit,
                consider buying me a coffee. Best wishes on your journey! 🙏
              </p>
              <a
                href={planData.status?.donationUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="coffee-popup-btn"
              >
                ☕ Buy Me a Coffee — $5
              </a>
              <button onClick={() => setShowCoffee(false)} className="coffee-popup-dismiss">Maybe later</button>
            </div>
          </div>
        )}
      </div>
    </PlanContext.Provider>
  );
};

export default App;
