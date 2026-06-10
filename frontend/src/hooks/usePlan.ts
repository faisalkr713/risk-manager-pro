import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../constants';

export interface PlanStatus {
  plan: 'free' | 'pro';
  monthlyTrades: number;
  monthlyAnalyses: number;
  limits: { trades: number; analyses: number };
  donationUrl: string;
}

export function usePlan() {
  const [status, setStatus] = useState<PlanStatus | null>(null);

  const refresh = useCallback(() => {
    const token = localStorage.getItem('rmp_token');
    if (!token) return;
    fetch(`${API_BASE}/payments/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data); })
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const isPro = status?.plan === 'pro';
  const tradesLeft = status ? Math.max(0, status.limits.trades - status.monthlyTrades) : 30;
  const analysesLeft = status ? Math.max(0, status.limits.analyses - status.monthlyAnalyses) : 1;

  async function startCheckout() {
    const token = localStorage.getItem('rmp_token');
    const res = await fetch(`${API_BASE}/payments/create-checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json() as { url?: string };
    if (data.url) window.location.href = data.url;
  }

  async function openPortal() {
    const token = localStorage.getItem('rmp_token');
    const res = await fetch(`${API_BASE}/payments/portal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json() as { url?: string };
    if (data.url) window.open(data.url, '_blank');
  }

  return { status, isPro, tradesLeft, analysesLeft, startCheckout, openPortal, refresh };
}
