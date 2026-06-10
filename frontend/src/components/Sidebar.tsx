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
}

const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, collapsed, onToggle, user, onLogout }) => (
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

    <nav className="sidebar-nav">
      {NAV_ITEMS.map(item => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            className={`nav-btn${isActive ? ' active' : ''}`}
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

    {/* User profile + logout */}
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
