import React from 'react';
import { Screen } from '../types';
import { NAV_ITEMS } from '../constants';
import { Theme } from '../hooks/useTheme';

interface SidebarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  collapsed: boolean;
  onToggle: () => void;
  user: { name: string; email: string };
  isGuest: boolean;
  onLogout: () => void;
  onShowAuth: (mode: 'login' | 'signup') => void;
  isPro: boolean;
  tradesLeft: number;
  theme: Theme;
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  active, onNavigate, collapsed, onToggle, user, isGuest,
  onLogout, onShowAuth, isPro, tradesLeft, theme, onToggleTheme,
}) => (
  <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
    <div className="sidebar-header" style={{ justifyContent: collapsed ? 'center' : 'space-between' }}>
      {!collapsed && (
        <div className="sidebar-logo">
          <span style={{ fontSize: 18 }}>⬡</span>
          <span>Risk Manager Pro</span>
        </div>
      )}
      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '→' : '←'}
      </button>
    </div>

    {/* Plan badge */}
    {!collapsed && (
      <div style={{ padding: '6px 12px 0' }}>
        <div style={{
          background: isPro ? 'linear-gradient(90deg,#2979FF,#9C27B0)' : 'var(--surface-2, #2A2A2A)',
          borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: isPro ? '#fff' : 'var(--text-dim, #888)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
            {isPro ? '⚡ PRO' : '🔓 FREE'}
          </span>
          {!isPro && (
            <span style={{ color: tradesLeft <= 5 ? '#FF1744' : '#FFA000', fontSize: 11, fontWeight: 600 }}>
              {tradesLeft} trades left
            </span>
          )}
        </div>
      </div>
    )}

    <nav className="sidebar-nav">
      {NAV_ITEMS.map(item => {
        const isActive = active === item.id;
        const isUpgrade = item.id === 'upgrade';
        return (
          <button
            key={item.id}
            className={`nav-btn${isActive ? ' active' : ''}${isUpgrade && !isPro ? ' nav-upgrade' : ''}`}
            onClick={() => onNavigate(item.id as Screen)}
            title={collapsed ? item.label : undefined}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '10px 12px' }}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        );
      })}
    </nav>

    {/* Theme toggle — always visible */}
    <div className="sidebar-theme">
      <button className="theme-toggle" onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
        {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
      </button>
    </div>

    {/* Profile / auth */}
    <div className="sidebar-profile">
      {isGuest ? (
        !collapsed ? (
          <div className="sp-guest">
            <div className="sp-guest-label">👤 Browsing as Guest</div>
            <button className="sp-signup-btn" onClick={() => onShowAuth('signup')}>Sign up — it's free</button>
            <button className="sp-login-link" onClick={() => onShowAuth('login')}>or Log in</button>
          </div>
        ) : (
          <button className="sp-logout sp-logout-collapsed" onClick={() => onShowAuth('signup')} title="Sign up / Log in">👤</button>
        )
      ) : (
        !collapsed ? (
          <div className="sp-row">
            <div className="sp-avatar">{(user.name || user.email)[0].toUpperCase()}</div>
            <div className="sp-info">
              <div className="sp-name">{user.name || 'Trader'}</div>
              <div className="sp-email">{user.email}</div>
            </div>
            <button className="sp-logout" onClick={onLogout} title="Sign out">⏻</button>
          </div>
        ) : (
          <button className="sp-logout sp-logout-collapsed" onClick={onLogout} title="Sign out">⏻</button>
        )
      )}
    </div>
  </aside>
);

export default Sidebar;
