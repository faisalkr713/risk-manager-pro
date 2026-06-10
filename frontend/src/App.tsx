import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './screens/Dashboard';
import Calculator from './screens/Calculator';
import DisciplineMode from './screens/DisciplineMode';
import Journal from './screens/Journal';
import Statistics from './screens/Statistics';
import BrokerProfiles from './screens/BrokerProfiles';
import AssetManager from './screens/AssetManager';
import ScreenshotAnalyzer from './screens/ScreenshotAnalyzer';
import { Screen } from './types';
import { NAV_ITEMS } from './constants';

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
  const [active, setActive] = useState<Screen>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

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
