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

    const { generatedAt, nextRefresh, signals } = await getSignals();
    const riskPer   = dayLoss / 4;      // risk budget per signal
    const targetPer = dayTarget / 4;    // profit target per signal
    const rr = riskPer > 0 ? targetPer / riskPer : 2;

    const out = signals.map(sig => {
      const stopDist = sig.atr;                      // price units
      const tpDist   = stopDist * rr;
      const size     = stopDist > 0 ? riskPer / stopDist : 0; // units
      const sl = sig.direction === 'BUY' ? sig.entry - stopDist : sig.entry + stopDist;
      const tp = sig.direction === 'BUY' ? sig.entry + tpDist   : sig.entry - tpDist;
      const dp = sig.entry < 10 ? 4 : 2;
      return {
        market: sig.market,
        direction: sig.direction,
        winChance: sig.winChance,
        entry: +sig.entry.toFixed(dp),
        stopLoss: +sl.toFixed(dp),
        takeProfit: +tp.toFixed(dp),
        positionSize: +size.toFixed(4),
        riskAmount: +riskPer.toFixed(2),
        targetAmount: +targetPer.toFixed(2),
        rr: +rr.toFixed(2),
      };
    });

    res.json({ generatedAt, nextRefresh, capital, signals: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

export default router;
