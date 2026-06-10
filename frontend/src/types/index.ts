export type Screen =
  | 'dashboard'
  | 'calculator'
  | 'journal'
  | 'statistics'
  | 'discipline'
  | 'brokers'
  | 'assets'
  | 'screenshot'
  | 'upgrade';

export interface Trade {
  id: number;
  date: string;
  time: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stop_loss: number;
  take_profit: number;
  quantity: number;
  result: 'WIN' | 'LOSS' | 'BE';
  profit_loss: number;
  notes: string;
  created_at: string;
}

export interface Settings {
  balance: string;
  daily_target: string;
  daily_loss_limit: string;
  risk_per_trade: string;
  max_trades_per_day: string;
  max_consecutive_losses: string;
  min_rr_ratio: string;
  discipline_mode_enabled: string;
}

export interface DailySummary {
  date: string;
  totalTrades: number;
  totalPnl: number;
  wins: number;
  losses: number;
  consecutiveLosses: number;
}

export interface Broker {
  id: number;
  name: string;
  asset_class: string;
  contract_size: number;
  tick_value: number;
  tick_size: number;
  leverage: number;
  commission: number;
  lot_step: number;
  is_custom: number;
  created_at: string;
}

export interface Asset {
  id: number;
  symbol: string;
  asset_type: string;
  contract_size: number;
  tick_size: number;
  tick_value: number;
  currency: string;
  leverage: number;
  created_at: string;
}

export interface Statistics {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  monthly: MonthlyPerformance[];
}

export interface MonthlyPerformance {
  month: string;
  profit: number;
  trades: number;
  wins: number;
}

export interface CalcResult {
  stopDistance: number;
  takeProfit: number;
  quantity: number;
  lotSize: number;
  marginRequired: number;
  positionValue: number;
  riskPercent: number;
  potentialProfit: number;
  potentialLoss: number;
  rrRatio: number;
}
