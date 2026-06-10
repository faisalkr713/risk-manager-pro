import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './screens/Dashboard';
import Calculator from './screens/Calculator';
import DisciplineMode from './screens/DisciplineMode';
import Journal from './screens/Journal';
import Statistics from './screens/Statistics';
import BrokerProfiles from './screens/BrokerProfiles';
import AssetManager from './screens/AssetManager';
import ScreenshotAnalyzer from './screens/ScreenshotAnalyzer';
import Auth from './screens/Auth';
import { Screen } from './types';
import { NAV_ITEMS } from './constants';
import { API_BASE } from './constants';

interface AuthUser { id: number; email: string; name: string; created_at: string; }

const renderScreen = (s: Screen) => {
  switch (s) {
    case 'dashboard':  return <Dashboard />;
    case 'calculator': return <Calculator />;
    case 'discipline': return <DisciplineMode />;
    case 'journal':    return <Journal />;
    case 'statistics': return <Statistics />;
    case 'brokers':    return <BrokerProfiles />;
    case 'assets':     return <AssetManager />;
    case 'screenshot': return <ScreenshotAnalyzer />;
    default:           return <Dashboard />;
  }
};

const App: React.FC = () => {
  const [active, setActive]       = useState<Screen>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // On mount, try to restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('rmp_token');
    if (!token) { setAuthChecked(true); return; }
    // Verify token is still valid
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUser(data.user); })
      .catch(() => { localStorage.removeItem('rmp_token'); })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleAuth = (token: string, u: AuthUser) => {
    localStorage.setItem('rmp_token', token);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('rmp_token');
    setUser(null);
  };

  // Waiting to check token
  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D0D0D' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #1e1e1e', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  // Not logged in — show auth screen
  if (!user) return <Auth onAuth={handleAuth} />;

  // Logged in — show full app
  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={setActive}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        user={user}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {renderScreen(active)}
      </main>

      {/* Mobile bottom nav */}
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
    </div>
  );
};

export default App;
