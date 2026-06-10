import { Router, Request, Response } from 'express';
import getDb from '../database';

const router = Router();

interface Trade {
  id: number;
  date: string;
  time: string;
  symbol: string;
  direction: string;
  entry: number;
  stop_loss: number;
  take_profit: number;
  quantity: number;
  result: string;
  profit_loss: number;
  notes: string;
  created_at: string;
}

// GET all trades with optional filters
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { date, symbol, direction, result, limit = '100', offset = '0' } = req.query;

    let query = 'SELECT * FROM trades WHERE 1=1';
    const params: (string | number)[] = [];

    if (date) { query += ' AND date = ?'; params.push(String(date)); }
    if (symbol) { query += ' AND UPPER(symbol) LIKE ?'; params.push(`%${String(symbol).toUpperCase()}%`); }
    if (direction) { query += ' AND direction = ?'; params.push(String(direction).toUpperCase()); }
    if (result) { query += ' AND result = ?'; params.push(String(result).toUpperCase()); }

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM trades WHERE 1=1${
      date ? ' AND date = ?' : ''
    }${symbol ? ' AND UPPER(symbol) LIKE ?' : ''}${
      direction ? ' AND direction = ?' : ''}${result ? ' AND result = ?' : ''}`;
    const countResult = db.get(countQuery, params) as unknown as { total: number };

    query += ' ORDER BY date DESC, time DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const trades = db.all(query, params) as unknown as Trade[];

    res.json({ trades, total: countResult.total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET stats overview — must be defined before /:id
router.get('/stats/overview', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const trades = db.all('SELECT * FROM trades ORDER BY date ASC, time ASC') as unknown as Trade[];

    const total = trades.length;
    const wins = trades.filter(t => t.result === 'WIN');
    const losses = trades.filter(t => t.result === 'LOSS');
    const breakevens = trades.filter(t => t.result === 'BE');

    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const totalProfit = wins.reduce((sum, t) => sum + t.profit_loss, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit_loss, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);
    const avgWin = wins.length > 0 ? totalProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
    const netPnl = trades.reduce((sum, t) => sum + t.profit_loss, 0);

    let peak = 0, maxDrawdown = 0, running = 0;
    for (const trade of trades) {
      running += trade.profit_loss;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const monthlyMap: Record<string, { profit: number; trades: number; wins: number }> = {};
    for (const trade of trades) {
      const month = trade.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { profit: 0, trades: 0, wins: 0 };
      monthlyMap[month].profit += trade.profit_loss;
      monthlyMap[month].trades++;
      if (trade.result === 'WIN') monthlyMap[month].wins++;
    }
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    res.json({
      total, wins: wins.length, losses: losses.length, breakevens: breakevens.length,
      winRate: Math.round(winRate * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalLoss: Math.round(totalLoss * 100) / 100,
      netPnl: Math.round(netPnl * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      monthly,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET single trade by id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const trade = db.get('SELECT * FROM trades WHERE id = ?', [req.params.id]) as unknown as Trade | undefined;
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// POST create trade
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { date, time, symbol, direction, entry, stop_loss, take_profit, quantity, result, profit_loss, notes } = req.body;

    if (!date || !time || !symbol || !direction || entry === undefined || stop_loss === undefined ||
        take_profit === undefined || !quantity || !result || profit_loss === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const r = db.run(
      'INSERT INTO trades (date, time, symbol, direction, entry, stop_loss, take_profit, quantity, result, profit_loss, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [date, time, String(symbol).toUpperCase(), String(direction).toUpperCase(),
       Number(entry), Number(stop_loss), Number(take_profit), Number(quantity),
       String(result).toUpperCase(), Number(profit_loss), notes || '']
    );

    const newTrade = db.get('SELECT * FROM trades WHERE id = ?', [r.lastInsertRowid]) as unknown as Trade;
    res.status(201).json(newTrade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// PUT update trade
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM trades WHERE id = ?', [req.params.id]) as unknown as Trade | undefined;
    if (!existing) return res.status(404).json({ error: 'Trade not found' });

    const { date, time, symbol, direction, entry, stop_loss, take_profit, quantity, result, profit_loss, notes } = req.body;

    db.run(
      'UPDATE trades SET date=?, time=?, symbol=?, direction=?, entry=?, stop_loss=?, take_profit=?, quantity=?, result=?, profit_loss=?, notes=? WHERE id=?',
      [
        date || existing.date, time || existing.time,
        symbol ? String(symbol).toUpperCase() : existing.symbol,
        direction ? String(direction).toUpperCase() : existing.direction,
        entry !== undefined ? Number(entry) : existing.entry,
        stop_loss !== undefined ? Number(stop_loss) : existing.stop_loss,
        take_profit !== undefined ? Number(take_profit) : existing.take_profit,
        quantity !== undefined ? Number(quantity) : existing.quantity,
        result ? String(result).toUpperCase() : existing.result,
        profit_loss !== undefined ? Number(profit_loss) : existing.profit_loss,
        notes !== undefined ? notes : existing.notes,
        req.params.id,
      ]
    );

    const updated = db.get('SELECT * FROM trades WHERE id = ?', [req.params.id]) as unknown as Trade;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// DELETE trade
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM trades WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Trade not found' });
    db.run('DELETE FROM trades WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

export default router;
