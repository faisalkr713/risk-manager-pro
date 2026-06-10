import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Settings, DailySummary, Statistics, Trade } from '../types';
import { apiGet } from '../hooks/useApi';
import { formatCurrency, formatPercent } from '../utils/calculations';

/* ── helpers ──────────────────────────────────────────────────────────────── */
const fc = formatCurrency;
const fp = formatPercent;

function pnlColor(v: number) { return v >= 0 ? '#22c55e' : '#ef4444'; }
function pnlSign(v: number)  { return v >= 0 ? '+' : ''; }

/** Build equity curve from all trades (cumulative PnL) */
function buildEquity(trades: Trade[], balance: number) {
  let running = balance;
  return [{ label: 'Start', value: running },
    ...trades.map((t, i) => {
      running += t.profit_loss;
      return { label: `#${i + 1}`, value: Math.round(running * 100) / 100 };
    }),
  ];
}

/** Last N trades for mini sparkline */
function buildSparkline(trades: Trade[], n = 20) {
  return trades.slice(-n).map((t, i) => ({ i, v: t.profit_loss }));
}

/** Account health score 0-100 */
function calcHealth(
  winRate: number,
  maxDD: number,
  balance: number,
  pnl: number,
  lossUsed: number,
  lossLimit: number,
): number {
  let score = 100;
  if (winRate < 50) score -= (50 - winRate) * 0.6;
  const ddPct = balance > 0 ? (maxDD / balance) * 100 : 0;
  if (ddPct > 5)  score -= (ddPct - 5) * 2;
  if (pnl < 0)    score -= Math.min(20, Math.abs(pnl / (balance || 1)) * 100);
  const lossRatio = lossLimit > 0 ? lossUsed / lossLimit : 0;
  if (lossRatio > 0.5) score -= (lossRatio - 0.5) * 40;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function healthLabel(s: number): { text: string; color: string } {
  if (s >= 90) return { text: 'Excellent', color: '#22c55e' };
  if (s >= 70) return { text: 'Good',      color: '#86efac' };
  if (s >= 50) return { text: 'Warning',   color: '#facc15' };
  return         { text: 'High Risk',  color: '#ef4444' };
}

/* ── SVG circular gauge ───────────────────────────────────────────────────── */
const CircleGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 120 }) => {
  const r = 44, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270° sweep
  const filled = arc * (score / 100);
  const { color } = healthLabel(score);
  const dashOffset = arc - filled;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth="10"
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={0}
        strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
      {/* fill */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`} strokeDashoffset={-dashOffset}
        strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="monospace">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={color} fontSize="10" fontWeight="600">{healthLabel(score).text}</text>
    </svg>
  );
};

/* ── small progress bar ────────────────────────────────────────────────────── */
const ProgressBar: React.FC<{ pct: number; color: string; h?: number }> = ({ pct, color, h = 6 }) => (
  <div style={{ background: '#1a1a1a', borderRadius: 99, height: h, overflow: 'hidden' }}>
    <div style={{
      width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%',
      background: color, borderRadius: 99,
      transition: 'width 0.5s ease',
    }} />
  </div>
);

/* ── custom recharts tooltip ──────────────────────────────────────────────── */
const ChartTip: React.FC<{ active?: boolean; payload?: { value: number }[]; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
      <div style={{ color: '#888' }}>{label}</div>
      <div style={{ color: pnlColor(v), fontWeight: 700 }}>{pnlSign(v)}{fc(v)}</div>
    </div>
  );
};

/* ── main component ───────────────────────────────────────────────────────── */
const Dashboard: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [daily,    setDaily]    = useState<DailySummary | null>(null);
  const [stats,    setStats]    = useState<Statistics | null>(null);
  const [trades,   setTrades]   = useState<Trade[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const [s, d, st, tr] = await Promise.all([
        apiGet<Settings>('/settings'),
        apiGet<DailySummary>('/settings/daily-summary'),
        apiGet<Statistics>('/trades/stats/overview'),
        apiGet<{ trades: Trade[] }>('/trades?limit=200').then(r => r.trades),
      ]);
      setSettings(s); setDaily(d); setStats(st); setTrades(tr as unknown as Trade[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const derived = useMemo(() => {
    if (!settings || !daily || !stats) return null;
    const balance      = parseFloat(settings.balance);
    const dailyTarget  = parseFloat(settings.daily_target);
    const lossLimit    = parseFloat(settings.daily_loss_limit);
    const maxTrades    = parseInt(settings.max_trades_per_day);
    const maxConsecLoss = parseInt(settings.max_consecutive_losses);
    const pnl          = daily.totalPnl;
    const targetPct    = dailyTarget > 0 ? Math.min(100, (Math.max(0, pnl) / dailyTarget) * 100) : 0;
    const lossUsed     = Math.abs(Math.min(0, pnl));
    const lossPct      = lossLimit > 0 ? Math.min(100, (lossUsed / lossLimit) * 100) : 0;
    const tradesLeft   = Math.max(0, maxTrades - daily.totalTrades);
    const targetLeft   = Math.max(0, dailyTarget - Math.max(0, pnl));
    const lossLeft     = Math.max(0, lossLimit - lossUsed);
    const riskPerTrade = parseFloat(settings.risk_per_trade);
    const health       = calcHealth(stats.winRate, stats.maxDrawdown, balance, pnl, lossUsed, lossLimit);
    const disciplineScore = Math.min(100, Math.round(
      (tradesLeft / Math.max(1, maxTrades)) * 30 +
      (stats.winRate > 0 ? Math.min(40, stats.winRate * 0.4) : 0) +
      ((1 - lossPct / 100) * 30)
    ));
    const equityCurve = buildEquity(trades, balance - stats.netPnl);
    const sparkline   = buildSparkline(trades);
    return {
      balance, dailyTarget, lossLimit, maxTrades, maxConsecLoss,
      pnl, targetPct, lossUsed, lossPct, tradesLeft, targetLeft, lossLeft,
      riskPerTrade, health, disciplineScore, equityCurve, sparkline,
    };
  }, [settings, daily, stats, trades]);

  if (loading) return (
    <div className="db-center">
      <div className="db-spinner" />
    </div>
  );
  if (error) return (
    <div className="db-center">
      <div className="db-error-box">
        <div style={{ fontSize: 32 }}>⚠</div>
        <p style={{ color: '#ef4444', margin: '8px 0' }}>{error}</p>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>Make sure the backend is running on port 3001.</p>
        <button className="db-btn-primary" onClick={load}>Retry</button>
      </div>
    </div>
  );
  if (!settings || !daily || !stats || !derived) return null;

  const { pnl, balance, dailyTarget, lossLimit, maxTrades, maxConsecLoss,
    targetPct, lossPct, tradesLeft, targetLeft, lossLeft, riskPerTrade,
    health, disciplineScore, equityCurve, sparkline } = derived;

  const isLossHit    = pnl <= -lossLimit;
  const isTargetHit  = pnl >= dailyTarget;
  const isTradesMax  = daily.totalTrades >= maxTrades;
  const equityMin = equityCurve.length > 1 ? Math.min(...equityCurve.map(e => e.value)) - 5 : balance - 50;
  const equityMax = equityCurve.length > 1 ? Math.max(...equityCurve.map(e => e.value)) + 5 : balance + 50;

  return (
    <div className="db-root">

      {/* ── alert bar ─────────────────────────────────────────────────────── */}
      {isLossHit  && <div className="db-alert danger">🚨 Daily loss limit reached — stop trading for today</div>}
      {isTargetHit && <div className="db-alert success">🎯 Daily target reached — lock in your profits</div>}
      {isTradesMax && !isTargetHit && !isLossHit && <div className="db-alert warning">⚠ Maximum trades reached for today</div>}

      {/* ── header ────────────────────────────────────────────────────────── */}
      <div className="db-header">
        <div>
          <h1 className="db-title">Risk Manager Pro</h1>
          <p className="db-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="db-btn-refresh" onClick={load}>↻ Refresh</button>
      </div>

      {/* ── Section 1: Account Summary ────────────────────────────────────── */}
      <div className="db-summary-row">
        <SummaryCard
          label="Account Balance"
          value={fc(balance)}
          color="#3b82f6"
          sub="Total equity"
          icon="◈"
        />
        <SummaryCard
          label="Today's P&L"
          value={`${pnlSign(pnl)}${fc(pnl)}`}
          color={pnlColor(pnl)}
          sub={`${pnlSign(pnl)}${balance > 0 ? ((pnl / balance) * 100).toFixed(2) : '0.00'}% of balance`}
          icon={pnl >= 0 ? '▲' : '▼'}
        />
        <SummaryCard
          label="Target Progress"
          value={`${targetPct.toFixed(0)}%`}
          color="#facc15"
          sub={`${fc(Math.max(0, pnl))} / ${fc(dailyTarget)}`}
          icon="◎"
          bar={{ pct: targetPct, color: '#facc15' }}
        />
        <SummaryCard
          label="Loss Buffer"
          value={fc(lossLeft)}
          color={lossPct > 70 ? '#ef4444' : '#22c55e'}
          sub={`${lossPct.toFixed(0)}% used of ${fc(lossLimit)}`}
          icon="⛨"
          bar={{ pct: lossPct, color: lossPct > 70 ? '#ef4444' : '#22c55e' }}
        />
        <SummaryCard
          label="Trades Left"
          value={`${tradesLeft} / ${maxTrades}`}
          color={tradesLeft === 0 ? '#ef4444' : '#3b82f6'}
          sub={`${daily.totalTrades} used today`}
          icon="≡"
        />
      </div>

      {/* ── Section 2: Equity Curve ────────────────────────────────────────── */}
      <div className="db-section-title">Equity Curve</div>
      <div className="db-card db-equity-card">
        <div className="db-equity-stats">
          <div className="db-eq-stat">
            <span className="db-eq-label">Net P&L</span>
            <span className="db-eq-value" style={{ color: pnlColor(stats.netPnl) }}>{pnlSign(stats.netPnl)}{fc(stats.netPnl)}</span>
          </div>
          <div className="db-eq-stat">
            <span className="db-eq-label">Total Trades</span>
            <span className="db-eq-value">{stats.total}</span>
          </div>
          <div className="db-eq-stat">
            <span className="db-eq-label">Max Drawdown</span>
            <span className="db-eq-value" style={{ color: '#ef4444' }}>-{fc(stats.maxDrawdown)}</span>
          </div>
          <div className="db-eq-stat">
            <span className="db-eq-label">Profit Factor</span>
            <span className="db-eq-value" style={{ color: stats.profitFactor >= 1.5 ? '#22c55e' : '#facc15' }}>
              {stats.profitFactor >= 999 ? '∞' : stats.profitFactor.toFixed(2)}
            </span>
          </div>
        </div>
        <div style={{ height: 160 }}>
          {equityCurve.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis domain={[equityMin, equityMax]} hide />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={balance - stats.netPnl} stroke="#333" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2}
                  fill="url(#eq-grad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-empty-chart">No trades yet — equity curve will appear here</div>
          )}
        </div>
      </div>

      {/* ── Section 3: Risk Metrics + Health Score ─────────────────────────── */}
      <div className="db-section-title">Risk & Health</div>
      <div className="db-risk-row">

        {/* Account Health */}
        <div className="db-card db-health-card">
          <div className="db-card-title">Account Health</div>
          <div className="db-health-body">
            <CircleGauge score={health} size={130} />
            <div className="db-health-factors">
              <HealthFactor label="Win Rate"     value={`${stats.winRate.toFixed(1)}%`}   good={stats.winRate >= 50} />
              <HealthFactor label="Max Drawdown" value={`-${fc(stats.maxDrawdown)}`}       good={stats.maxDrawdown < balance * 0.1} />
              <HealthFactor label="Today P&L"    value={`${pnlSign(pnl)}${fc(pnl)}`}       good={pnl >= 0} />
              <HealthFactor label="Loss Used"    value={`${lossPct.toFixed(0)}% of limit`} good={lossPct < 50} />
            </div>
          </div>
        </div>

        {/* Daily Target */}
        <div className="db-card">
          <div className="db-card-title">Daily Target</div>
          <div className="db-risk-number" style={{ color: '#facc15' }}>{fc(dailyTarget)}</div>
          <div className="db-risk-sub">Target for today</div>
          <div className="db-progress-group">
            <div className="db-progress-row">
              <span>Current P&L</span>
              <span style={{ color: pnlColor(pnl) }}>{pnlSign(pnl)}{fc(pnl)}</span>
            </div>
            <ProgressBar pct={targetPct} color="#facc15" h={8} />
            <div className="db-progress-row">
              <span style={{ color: '#555' }}>{targetPct.toFixed(1)}% complete</span>
              <span style={{ color: '#555' }}>{fc(targetLeft)} remaining</span>
            </div>
          </div>
        </div>

        {/* Risk Exposure */}
        <div className="db-card">
          <div className="db-card-title">Risk Exposure</div>
          <div className="db-risk-number" style={{ color: lossPct > 70 ? '#ef4444' : '#22c55e' }}>
            {lossPct.toFixed(0)}%
          </div>
          <div className="db-risk-sub">of daily loss limit used</div>
          <div className="db-progress-group">
            <div className="db-progress-row">
              <span style={{ color: '#ef4444' }}>Risk Used</span>
              <span style={{ color: '#ef4444' }}>{fc(Math.abs(Math.min(0, pnl)))}</span>
            </div>
            <ProgressBar pct={lossPct} color={lossPct > 70 ? '#ef4444' : '#22c55e'} h={8} />
            <div className="db-progress-row">
              <span style={{ color: '#555' }}>Risk Remaining</span>
              <span style={{ color: '#22c55e' }}>{fc(lossLeft)}</span>
            </div>
          </div>
          <div className="db-risk-meta">Risk per trade: <strong>{fc(riskPerTrade)}</strong></div>
        </div>

      </div>

      {/* ── Section 4: Performance Analytics ──────────────────────────────── */}
      <div className="db-section-title">Performance Analytics</div>
      <div className="db-analytics-row">

        <AnalyticTile label="Win Rate"       value={fp(stats.winRate)}         color={stats.winRate >= 50 ? '#22c55e' : '#ef4444'}   sub={`${stats.wins}W / ${stats.losses}L`} />
        <AnalyticTile label="Profit Factor"  value={stats.profitFactor >= 999 ? '∞' : stats.profitFactor.toFixed(2)} color={stats.profitFactor >= 1.5 ? '#22c55e' : '#facc15'} sub="Gross profit / loss" />
        <AnalyticTile label="Avg Win"        value={`+${fc(stats.avgWin)}`}    color="#22c55e"  sub="Per winning trade" />
        <AnalyticTile label="Avg Loss"       value={`-${fc(stats.avgLoss)}`}   color="#ef4444"  sub="Per losing trade" />
        <AnalyticTile label="Max Drawdown"   value={`-${fc(stats.maxDrawdown)}`} color="#ef4444" sub="Peak to trough" />
        <AnalyticTile label="Total Trades"   value={String(stats.total)}       color="#3b82f6"  sub={`${stats.breakevens} break-even`} />

      </div>

      {/* sparkline — last 20 trades P&L */}
      {sparkline.length > 1 && (
        <div className="db-card db-sparkline-card">
          <div className="db-card-title">Recent Trade P&L  <span style={{ color: '#555', fontWeight: 400, fontSize: 11 }}>last {sparkline.length} trades</span></div>
          <div style={{ height: 70 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sparkline} barSize={8} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="i" hide />
                <YAxis hide />
                <ReferenceLine y={0} stroke="#333" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const v = payload[0].value as number;
                  return <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}><span style={{ color: pnlColor(v) }}>{pnlSign(v)}{fc(v)}</span></div>;
                }} />
                <Bar dataKey="v" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {sparkline.map((entry, index) => (
                    <Cell key={index} fill={entry.v >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Section 5: Discipline Tracker ─────────────────────────────────── */}
      <div className="db-section-title">Discipline Tracker</div>
      <div className="db-discipline-row">

        <div className="db-card db-disc-score-card">
          <div className="db-card-title">Discipline Score</div>
          <div className="db-disc-big" style={{ color: disciplineScore >= 70 ? '#22c55e' : disciplineScore >= 50 ? '#facc15' : '#ef4444' }}>
            {disciplineScore}<span style={{ fontSize: 18, color: '#555' }}>/100</span>
          </div>
          <ProgressBar pct={disciplineScore} color={disciplineScore >= 70 ? '#22c55e' : disciplineScore >= 50 ? '#facc15' : '#ef4444'} h={6} />
        </div>

        <div className="db-card">
          <div className="db-card-title">Trade Discipline</div>
          <div className="db-disc-stat">
            <div className="db-disc-label">Trades Used</div>
            <div className="db-disc-val">{daily.totalTrades} <span className="db-disc-of">/ {maxTrades}</span></div>
            <ProgressBar pct={(daily.totalTrades / maxTrades) * 100} color={isTradesMax ? '#ef4444' : '#3b82f6'} h={4} />
          </div>
          <div className="db-disc-stat" style={{ marginTop: 12 }}>
            <div className="db-disc-label">Trades Remaining</div>
            <div className="db-disc-val" style={{ color: tradesLeft === 0 ? '#ef4444' : '#22c55e' }}>{tradesLeft}</div>
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-title">Loss Control</div>
          <div className="db-disc-stat">
            <div className="db-disc-label">Consecutive Losses</div>
            <div className="db-disc-val" style={{ color: daily.consecutiveLosses >= maxConsecLoss ? '#ef4444' : '#fff' }}>
              {daily.consecutiveLosses} <span className="db-disc-of">/ {maxConsecLoss} max</span>
            </div>
            <ProgressBar pct={(daily.consecutiveLosses / Math.max(1, maxConsecLoss)) * 100} color={daily.consecutiveLosses >= maxConsecLoss ? '#ef4444' : '#facc15'} h={4} />
          </div>
          <div className="db-disc-stat" style={{ marginTop: 12 }}>
            <div className="db-disc-label">Daily Rule Compliance</div>
            <div className="db-disc-val" style={{ color: '#22c55e' }}>
              {isLossHit || isTradesMax ? 'Limit Hit' : isTargetHit ? 'Target Hit' : 'Active'}
            </div>
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-title">Win / Loss Split</div>
          <div className="db-wl-row">
            <div className="db-wl-item">
              <div className="db-wl-num" style={{ color: '#22c55e' }}>{daily.wins}</div>
              <div className="db-wl-label">Wins</div>
            </div>
            <div className="db-wl-divider" />
            <div className="db-wl-item">
              <div className="db-wl-num" style={{ color: '#ef4444' }}>{daily.losses}</div>
              <div className="db-wl-label">Losses</div>
            </div>
            <div className="db-wl-divider" />
            <div className="db-wl-item">
              <div className="db-wl-num" style={{ color: '#555' }}>{daily.totalTrades - daily.wins - daily.losses}</div>
              <div className="db-wl-label">B/E</div>
            </div>
          </div>
          {daily.totalTrades > 0 && (
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1, marginTop: 12 }}>
              <div style={{ flex: daily.wins,   background: '#22c55e' }} />
              <div style={{ flex: daily.losses, background: '#ef4444' }} />
              <div style={{ flex: Math.max(0, daily.totalTrades - daily.wins - daily.losses), background: '#555' }} />
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

/* ── subcomponents ────────────────────────────────────────────────────────── */
const SummaryCard: React.FC<{
  label: string; value: string; color: string; sub: string; icon: string;
  bar?: { pct: number; color: string };
}> = ({ label, value, color, sub, icon, bar }) => (
  <div className="db-summary-card" style={{ borderTopColor: color }}>
    <div className="db-sc-icon" style={{ color }}>{icon}</div>
    <div className="db-sc-value" style={{ color }}>{value}</div>
    <div className="db-sc-label">{label}</div>
    <div className="db-sc-sub">{sub}</div>
    {bar && <div style={{ marginTop: 8 }}><ProgressBar pct={bar.pct} color={bar.color} h={3} /></div>}
  </div>
);

const HealthFactor: React.FC<{ label: string; value: string; good: boolean }> = ({ label, value, good }) => (
  <div className="db-hf-row">
    <span className="db-hf-dot" style={{ background: good ? '#22c55e' : '#ef4444' }} />
    <span className="db-hf-label">{label}</span>
    <span className="db-hf-value" style={{ color: good ? '#22c55e' : '#ef4444' }}>{value}</span>
  </div>
);

const AnalyticTile: React.FC<{ label: string; value: string; color: string; sub: string }> = ({ label, value, color, sub }) => (
  <div className="db-card db-analytic-tile">
    <div className="db-at-value" style={{ color }}>{value}</div>
    <div className="db-at-label">{label}</div>
    <div className="db-at-sub">{sub}</div>
  </div>
);

export default Dashboard;
