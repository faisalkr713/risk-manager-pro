import React, { useEffect, useState } from 'react';
import { Statistics as StatsType } from '../types';
import { apiGet } from '../hooks/useApi';
import { formatCurrency, formatPercent } from '../utils/calculations';

const Statistics: React.FC = () => {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<StatsType>('/trades/stats/overview')
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, color: '#B0B0B0' }}>Loading...</div>;
  if (error) return <div style={{ padding: 24, color: '#FF1744' }}>Error: {error}</div>;
  if (!stats) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>Statistics</h1>
        <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>All-time trading performance analysis</p>
      </div>

      {stats.total === 0 ? (
        <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 60, border: '1px solid #2A2A2A', textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <p>No trades yet. Add trades in the Trade Journal to see statistics.</p>
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
            <KpiCard label="Total Trades" value={String(stats.total)} />
            <KpiCard label="Wins" value={String(stats.wins)} color="#00C853" />
            <KpiCard label="Losses" value={String(stats.losses)} color="#FF1744" />
            <KpiCard label="Break Evens" value={String(stats.breakevens)} color="#FFD600" />
            <KpiCard label="Win Rate" value={formatPercent(stats.winRate)} color={stats.winRate >= 50 ? '#00C853' : '#FF1744'} />
            <KpiCard label="Profit Factor" value={String(stats.profitFactor)} color={stats.profitFactor >= 1.5 ? '#00C853' : stats.profitFactor >= 1 ? '#FFD600' : '#FF1744'} />
            <KpiCard label="Net PnL" value={`${stats.netPnl >= 0 ? '+' : ''}${formatCurrency(stats.netPnl)}`} color={stats.netPnl >= 0 ? '#00C853' : '#FF1744'} />
            <KpiCard label="Total Profit" value={formatCurrency(stats.totalProfit)} color="#00C853" />
            <KpiCard label="Total Loss" value={formatCurrency(stats.totalLoss)} color="#FF1744" />
            <KpiCard label="Avg Win" value={formatCurrency(stats.avgWin)} color="#00C853" />
            <KpiCard label="Avg Loss" value={formatCurrency(stats.avgLoss)} color="#FF1744" />
            <KpiCard label="Max Drawdown" value={formatCurrency(stats.maxDrawdown)} color="#FFD600" />
          </div>

          {/* Win/Loss Visual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <WinLossDonut wins={stats.wins} losses={stats.losses} bes={stats.breakevens} />
            <PnlSummaryCard stats={stats} />
          </div>

          {/* Monthly Performance Chart */}
          {stats.monthly.length > 0 && (
            <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 24, border: '1px solid #2A2A2A' }}>
              <h2 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>Monthly Performance</h2>
              <MonthlyBarChart data={stats.monthly} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#FFFFFF' }) => (
  <div style={{ background: '#1E1E1E', borderRadius: 10, padding: '14px 16px', border: '1px solid #2A2A2A' }}>
    <div style={{ color: '#666', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
    <div style={{ color, fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
  </div>
);

const WinLossDonut: React.FC<{ wins: number; losses: number; bes: number }> = ({ wins, losses, bes }) => {
  const total = wins + losses + bes;
  if (total === 0) return null;

  const winPct = (wins / total) * 100;
  const lossPct = (losses / total) * 100;
  const bePct = (bes / total) * 100;

  // SVG donut chart
  const cx = 80, cy = 80, r = 60, strokeWidth = 20;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { pct: winPct, color: '#00C853', label: 'Wins', count: wins },
    { pct: lossPct, color: '#FF1744', label: 'Losses', count: losses },
    { pct: bePct, color: '#FFD600', label: 'BE', count: bes },
  ];

  let offset = 0;
  const arcs = segments.map(seg => {
    const dashArray = (seg.pct / 100) * circumference;
    const dashOffset = -offset;
    offset += dashArray;
    return { ...seg, dashArray, dashOffset };
  });

  return (
    <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 24, border: '1px solid #2A2A2A' }}>
      <h2 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>Trade Distribution</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A2A2A" strokeWidth={strokeWidth} />
          {arcs.map((arc, i) => arc.pct > 0 && (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dashArray} ${circumference - arc.dashArray}`}
              strokeDashoffset={arc.dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          ))}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#FFFFFF" fontSize={22} fontWeight="bold" fontFamily="monospace">
            {Math.round(winPct)}%
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#666" fontSize={11}>
            Win Rate
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {segments.map(seg => (
            <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <div>
                <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 14 }}>{seg.count} {seg.label}</div>
                <div style={{ color: '#666', fontSize: 11 }}>{seg.pct.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PnlSummaryCard: React.FC<{ stats: StatsType }> = ({ stats }) => (
  <div style={{ background: '#1E1E1E', borderRadius: 12, padding: 24, border: '1px solid #2A2A2A' }}>
    <h2 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>PnL Summary</h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PnlRow label="Total Profit" value={`+${formatCurrency(stats.totalProfit)}`} color="#00C853" barPct={100} barColor="#00C853" />
      <PnlRow
        label="Total Loss"
        value={`-${formatCurrency(stats.totalLoss)}`}
        color="#FF1744"
        barPct={stats.totalProfit > 0 ? (stats.totalLoss / stats.totalProfit) * 100 : 100}
        barColor="#FF1744"
      />
      <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#B0B0B0', fontSize: 14 }}>Net PnL</span>
          <span style={{ color: stats.netPnl >= 0 ? '#00C853' : '#FF1744', fontWeight: 700, fontSize: 20, fontFamily: 'monospace' }}>
            {stats.netPnl >= 0 ? '+' : ''}{formatCurrency(stats.netPnl)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <InfoItem label="Avg Win" value={`+${formatCurrency(stats.avgWin)}`} color="#00C853" />
        <InfoItem label="Avg Loss" value={`-${formatCurrency(stats.avgLoss)}`} color="#FF1744" />
        <InfoItem label="Profit Factor" value={String(stats.profitFactor)} color={stats.profitFactor >= 1 ? '#00C853' : '#FF1744'} />
      </div>
    </div>
  </div>
);

const PnlRow: React.FC<{ label: string; value: string; color: string; barPct: number; barColor: string }> = ({ label, value, color, barPct, barColor }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ color: '#B0B0B0', fontSize: 13 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
    <div style={{ background: '#2A2A2A', borderRadius: 4, height: 5 }}>
      <div style={{ background: barColor, height: '100%', width: `${Math.min(100, barPct)}%`, borderRadius: 4 }} />
    </div>
  </div>
);

const InfoItem: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
  </div>
);

interface MonthlyData { month: string; profit: number; trades: number; wins: number }

const MonthlyBarChart: React.FC<{ data: MonthlyData[] }> = ({ data }) => {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.profit)), 1);
  const chartHeight = 200;
  const barWidth = Math.max(30, Math.min(60, (700 / data.length) - 10));
  const totalWidth = data.length * (barWidth + 10);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width={Math.max(totalWidth, 600)}
        height={chartHeight + 60}
        style={{ display: 'block' }}
      >
        {/* Zero line */}
        <line
          x1={0}
          y1={chartHeight / 2}
          x2={Math.max(totalWidth, 600)}
          y2={chartHeight / 2}
          stroke="#2A2A2A"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const x = i * (barWidth + 10) + 5;
          const isPositive = d.profit >= 0;
          const barH = Math.max(2, (Math.abs(d.profit) / maxAbs) * (chartHeight / 2 - 10));
          const barY = isPositive ? chartHeight / 2 - barH : chartHeight / 2;
          const color = isPositive ? '#00C853' : '#FF1744';

          return (
            <g key={d.month}>
              {/* Bar */}
              <rect
                x={x}
                y={barY}
                width={barWidth}
                height={barH}
                fill={color}
                opacity={0.85}
                rx={3}
              />
              {/* Value label */}
              <text
                x={x + barWidth / 2}
                y={isPositive ? barY - 4 : barY + barH + 14}
                textAnchor="middle"
                fill={color}
                fontSize={10}
                fontFamily="monospace"
              >
                {isPositive ? '+' : ''}{d.profit.toFixed(0)}
              </text>
              {/* Month label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 20}
                textAnchor="middle"
                fill="#666"
                fontSize={10}
              >
                {d.month.slice(5)}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 34}
                textAnchor="middle"
                fill="#444"
                fontSize={9}
              >
                {d.month.slice(0, 4)}
              </text>
              {/* Trade count */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 48}
                textAnchor="middle"
                fill="#444"
                fontSize={9}
              >
                {d.trades}T
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default Statistics;
