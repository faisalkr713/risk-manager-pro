import React from 'react';
import { Screen } from '../types';
import { NAV_ITEMS } from '../constants';

interface SidebarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, collapsed, onToggle }) => (
  <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
    <div className="sidebar-header" style={{ justifyContent: collapsed ? 'center' : 'space-between' }}>
      {!collapsed && (
        <div className="sidebar-logo">
          <span style={{ fontSize: 18 }}>📊</span>
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

    <div className="sidebar-footer">
      {!collapsed && 'v1.0.0 • Risk Manager Pro'}
    </div>
  </aside>
);

export default Sidebar;
