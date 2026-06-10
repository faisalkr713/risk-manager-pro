import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'success' | 'danger' | 'warning' | 'accent' | 'default';
  icon?: string;
  large?: boolean;
}

const colorMap = {
  success: '#00C853',
  danger: '#FF1744',
  warning: '#FFD600',
  accent: '#2979FF',
  default: '#FFFFFF',
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  color = 'default',
  icon,
  large = false,
}) => {
  const valueColor = colorMap[color];

  return (
    <div
      style={{
        background: '#1E1E1E',
        borderRadius: 12,
        padding: large ? '24px' : '16px 20px',
        border: '1px solid #2A2A2A',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = '#3A3A3A')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = '#2A2A2A')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: large ? 22 : 16 }}>{icon}</span>}
        <span style={{ color: '#B0B0B0', fontSize: large ? 13 : 12, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div
        style={{
          color: valueColor,
          fontSize: large ? 32 : 22,
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ color: '#666666', fontSize: 11 }}>{subValue}</div>
      )}
    </div>
  );
};

export default StatCard;
