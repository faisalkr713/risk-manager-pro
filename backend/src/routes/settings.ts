import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET all settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings WHERE user_id = $1', [req.user!.userId]);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT update settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        'INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value',
        [req.user!.userId, key, String(value)]
      );
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET daily summary
router.get('/daily-summary', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      'SELECT result, profit_loss FROM trades WHERE user_id = $1 AND date = $2',
      [req.user!.userId, today]
    );

    const wins   = rows.filter((t: { result: string }) => t.result === 'WIN').length;
    const losses = rows.filter((t: { result: string }) => t.result === 'LOSS').length;
    const totalPnl = rows.reduce((sum: number, t: { profit_loss: number }) => sum + Number(t.profit_loss), 0);

    let consecutiveLosses = 0;
    for (const t of [...rows].reverse()) {
      if (t.result === 'LOSS') consecutiveLosses++; else break;
    }

    res.json({
      date: today,
      totalTrades: rows.length,
      totalPnl: Math.round(totalPnl * 100) / 100,
      wins, losses, consecutiveLosses,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

export default router;
