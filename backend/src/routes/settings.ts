import { Router, Request, Response } from 'express';
import getDb from '../database';

const router = Router();

// GET all settings
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.all('SELECT key, value FROM settings') as unknown as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
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
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, String(value)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET daily summary
router.get('/daily-summary', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const todayTrades = db.all(
      'SELECT id, result, profit_loss FROM trades WHERE date = ?',
      [today]
    ) as unknown as Array<{ id: number; result: string; profit_loss: number }>;

    const totalTrades = todayTrades.length;
    const totalPnl = todayTrades.reduce((sum, t) => sum + t.profit_loss, 0);
    const wins = todayTrades.filter(t => t.result === 'WIN').length;
    const losses = todayTrades.filter(t => t.result === 'LOSS').length;

    let consecutiveLosses = 0;
    const reversed = [...todayTrades].reverse();
    for (const trade of reversed) {
      if (trade.result === 'LOSS') {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    res.json({
      date: today,
      totalTrades,
      totalPnl: Math.round(totalPnl * 100) / 100,
      wins,
      losses,
      consecutiveLosses,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

export default router;
