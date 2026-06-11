import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../middleware/auth';
import { getSignals } from '../services/signalService';

const router = Router();
router.use(requireAuth);

// GET /api/signals — 4 daily signals personalized to the user's presets
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings WHERE user_id = $1', [req.user!.userId]);
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;

    const capital   = parseFloat(s.balance) || 10000;
    const dayTarget = parseFloat(s.daily_target) || 200;
    const dayLoss   = parseFloat(s.daily_loss_limit) || 100;

    const { windowStart, nextRefresh, entryDeadline, marketOpen, signals } = await getSignals();
    const riskPer   = dayLoss / 4;      // risk budget per signal
    const targetPer = dayTarget / 4;    // profit target per signal
    const rr = riskPer > 0 ? targetPer / riskPer : 2;

    const out = signals.map(sig => {
      const stopDist = sig.atr;                      // price units
      const tpDist   = stopDist * rr;
      const size     = stopDist > 0 ? riskPer / stopDist : 0; // units
      const sl  = sig.direction === 'BUY' ? sig.entry - stopDist : sig.entry + stopDist;
      const tp1 = sig.direction === 'BUY' ? sig.entry + tpDist        : sig.entry - tpDist;
      const tp2 = sig.direction === 'BUY' ? sig.entry + tpDist * 1.75 : sig.entry - tpDist * 1.75;
      const dp = sig.entry < 10 ? 4 : 2;
      return {
        market: sig.market,
        direction: sig.direction,
        winChance: sig.winChance,
        entry: +sig.entry.toFixed(dp),        // entry price
        stopLoss: +sl.toFixed(dp),            // exit price if stopped
        takeProfit: +tp1.toFixed(dp),         // TP1
        takeProfit2: +tp2.toFixed(dp),        // TP2 (stretch)
        positionSize: +size.toFixed(4),       // units
        profitPerTrade: +targetPer.toFixed(2),// profit if TP1 hit
        lossPerTrade: +riskPer.toFixed(2),    // loss if SL hit
        riskAmount: +riskPer.toFixed(2),
        targetAmount: +targetPer.toFixed(2),
        rr: +rr.toFixed(2),
        spark: sig.spark.map(v => +v.toFixed(dp)),
      };
    });

    res.json({ generatedAt: windowStart, windowStart, nextRefresh, entryDeadline, marketOpen, capital, signals: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

export default router;
