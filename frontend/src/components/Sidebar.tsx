import React from 'react';
import { Screen } from '../types';
import { NAV_ITEMS } from '../constants';

interface SidebarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  collapsed: boolean;
  onToggle: () => void;
  user: { name: string; email: string };
  onLogout: () => void;
  isPro: boolean;
  tradesLeft: number;
}

const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, collapsed, onToggle, user, onLogout, isPro, tradesLeft }) => (
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
          background: isPro ? 'linear-gradient(90deg,#2979FF,#9C27B0)' : '#2A2A2A',
          borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: isPro ? '#fff' : '#888', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
            {isPro ? '⚡ PRO' : '🔓 FREE'}
          </span>
          {!isPro && (
            <span style={{ color: tradesLeft <= 5 ? '#FF1744' : '#FFD600', fontSize: 11, fontWeight: 600 }}>
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
            className={`nav-btn${isActive ? ' active' : ''}`}
            onClick={() => onNavigate(item.id as Screen)}
            title={collapsed ? item.label : undefined}
            style={{
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '10px 0' : '10px 12px',
              ...(isUpgrade && !isPro ? {
                background: 'linear-gradient(90deg, rgba(41,121,255,0.15), rgba(156,39,176,0.15))',
                borderLeft: '2px solid #2979FF',
                color: '#2979FF',
              } : {}),
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span style={isUpgrade && !isPro ? { fontWeight: 700, color: '#2979FF' } : {}}>{item.label}</span>}
          </button>
        );
      })}
    </nav>

    <div className="sidebar-profile">
      {!collapsed ? (
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
      )}
    </div>
  </aside>
);

export default Sidebar;
