import { CalcResult } from '../types';

export interface CalcInputs {
  assetType: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLossPrice: number;
  riskAmount: number;
  rewardRiskRatio: number;
  leverage: number;
  contractSize: number;
  tickSize: number;
  tickValue: number;
  accountBalance: number;
}

export function calculateRisk(inputs: CalcInputs): CalcResult {
  const {
    direction,
    entryPrice,
    stopLossPrice,
    riskAmount,
    rewardRiskRatio,
    leverage,
    contractSize,
    tickSize,
    tickValue,
    accountBalance,
  } = inputs;

  // Stop distance in price units
  const stopDistance = Math.abs(entryPrice - stopLossPrice);

  // Take profit
  const takeProfitDistance = stopDistance * rewardRiskRatio;
  const takeProfit =
    direction === 'BUY'
      ? entryPrice + takeProfitDistance
      : entryPrice - takeProfitDistance;

  // For forex: quantity in units, lot size in standard lots
  // For crypto: quantity in base units
  // Generic formula: riskAmount / (stopDistance / tickSize * tickValue / contractSize)

  let quantity = 0;
  let lotSize = 0;

  if (stopDistance > 0 && tickSize > 0) {
    const ticksInStop = stopDistance / tickSize;
    const riskPerUnit = (ticksInStop * tickValue) / contractSize;

    if (riskPerUnit > 0) {
      quantity = riskAmount / riskPerUnit;
      lotSize = quantity / contractSize;
    }
  }

  const positionValue = quantity * entryPrice;
  const marginRequired = leverage > 0 ? positionValue / leverage : positionValue;
  const riskPercent = accountBalance > 0 ? (riskAmount / accountBalance) * 100 : 0;
  const potentialProfit = riskAmount * rewardRiskRatio;
  const potentialLoss = riskAmount;

  return {
    stopDistance: round(stopDistance, 8),
    takeProfit: round(takeProfit, 8),
    quantity: round(quantity, 4),
    lotSize: round(lotSize, 4),
    marginRequired: round(marginRequired, 2),
    positionValue: round(positionValue, 2),
    riskPercent: round(riskPercent, 2),
    potentialProfit: round(potentialProfit, 2),
    potentialLoss: round(potentialLoss, 2),
    rrRatio: rewardRiskRatio,
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatCurrency(value: number, decimals = 2): string {
  return `$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(8);
}

export function getDefaultContractSpec(assetType: string): {
  contractSize: number;
  tickSize: number;
  tickValue: number;
} {
  switch (assetType) {
    case 'Forex':
      return { contractSize: 100000, tickSize: 0.0001, tickValue: 10 };
    case 'Crypto':
      return { contractSize: 1, tickSize: 0.01, tickValue: 0.01 };
    case 'Stocks':
      return { contractSize: 1, tickSize: 0.01, tickValue: 0.01 };
    case 'Futures':
      return { contractSize: 50, tickSize: 0.25, tickValue: 12.5 };
    case 'Indices':
      return { contractSize: 1, tickSize: 0.1, tickValue: 1 };
    case 'Commodities':
      return { contractSize: 1000, tickSize: 0.01, tickValue: 10 };
    case 'Metals':
      return { contractSize: 100, tickSize: 0.01, tickValue: 1 };
    default:
      return { contractSize: 1, tickSize: 0.01, tickValue: 1 };
  }
}
