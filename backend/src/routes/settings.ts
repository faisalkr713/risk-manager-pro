import { Router, Request, Response } from 'express';
import getDb from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET all settings
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.all('SELECT key, value FROM settings WHERE user_id = ?', [req.user!.userId]) as unknown as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT update settings
router.put('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      db.run(
        'INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
        [req.user!.userId, key, String(value)]
      );
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET daily summary
router.get('/daily-summary', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = db.all(
      'SELECT result, profit_loss FROM trades WHERE user_id = ? AND date = ?',
      [req.user!.userId, today]
    ) as unknown as Array<{ result: string; profit_loss: number }>;

    const wins   = todayTrades.filter(t => t.result === 'WIN').length;
    const losses = todayTrades.filter(t => t.result === 'LOSS').length;
    const totalPnl = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0);

    let consecutiveLosses = 0;
    for (const t of [...todayTrades].reverse()) {
      if (t.result === 'LOSS') consecutiveLosses++; else break;
    }

    res.json({
      date: today,
      totalTrades: todayTrades.length,
      totalPnl: Math.round(totalPnl * 100) / 100,
      wins, losses, consecutiveLosses,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

export default router;
