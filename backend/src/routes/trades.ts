import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

interface Trade {
  id: number; user_id: number; date: string; time: string;
  symbol: string; direction: string; entry: number; stop_loss: number;
  take_profit: number; quantity: number; result: string;
  profit_loss: number; notes: string; created_at: string;
}

// GET all trades (with filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { date, symbol, direction, result, limit = '100', offset = '0' } = req.query;
    const params: (string | number)[] = [req.user!.userId];
    let where = 'WHERE user_id = $1';
    let i = 2;

    if (date)      { where += ` AND date = $${i++}`;                          params.push(String(date)); }
    if (symbol)    { where += ` AND UPPER(symbol) LIKE $${i++}`;              params.push(`%${String(symbol).toUpperCase()}%`); }
    if (direction) { where += ` AND direction = $${i++}`;                     params.push(String(direction).toUpperCase()); }
    if (result)    { where += ` AND result = $${i++}`;                        params.push(String(result).toUpperCase()); }

    const countRes = await pool.query(`SELECT COUNT(*) as total FROM trades ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const dataParams = [...params, Number(limit), Number(offset)];
    const { rows } = await pool.query(
      `SELECT * FROM trades ${where} ORDER BY date DESC, time DESC LIMIT $${i} OFFSET $${i + 1}`,
      dataParams
    );
    res.json({ trades: rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET stats overview
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { rows: trades } = await pool.query(
      'SELECT * FROM trades WHERE user_id = $1 ORDER BY date ASC, time ASC',
      [req.user!.userId]
    ) as { rows: Trade[] };

    const total = trades.length;
    const wins   = trades.filter(t => t.result === 'WIN');
    const losses = trades.filter(t => t.result === 'LOSS');
    const bes    = trades.filter(t => t.result === 'BE');

    const winRate      = total > 0 ? (wins.length / total) * 100 : 0;
    const totalProfit  = wins.reduce((s, t) => s + Number(t.profit_loss), 0);
    const totalLoss    = Math.abs(losses.reduce((s, t) => s + Number(t.profit_loss), 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);
    const avgWin  = wins.length   > 0 ? totalProfit / wins.length   : 0;
    const avgLoss = losses.length > 0 ? totalLoss   / losses.length : 0;
    const netPnl  = trades.reduce((s, t) => s + Number(t.profit_loss), 0);

    let peak = 0, maxDrawdown = 0, running = 0;
    for (const t of trades) {
      running += Number(t.profit_loss);
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const monthlyMap: Record<string, { profit: number; trades: number; wins: number }> = {};
    for (const t of trades) {
      const month = t.date.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { profit: 0, trades: 0, wins: 0 };
      monthlyMap[month].profit += Number(t.profit_loss);
      monthlyMap[month].trades++;
      if (t.result === 'WIN') monthlyMap[month].wins++;
    }
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    const round = (n: number) => Math.round(n * 100) / 100;
    res.json({
      total, wins: wins.length, losses: losses.length, breakevens: bes.length,
      winRate: round(winRate), totalProfit: round(totalProfit), totalLoss: round(totalLoss),
      netPnl: round(netPnl), profitFactor: round(profitFactor),
      avgWin: round(avgWin), avgLoss: round(avgLoss), maxDrawdown: round(maxDrawdown),
      monthly,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET single trade
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM trades WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Trade not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// POST create trade
router.post('/', async (req: Request, res: Response) => {
  try {
    const { date, time, symbol, direction, entry, stop_loss, take_profit, quantity, result, profit_loss, notes } = req.body;
    if (!date || !time || !symbol || !direction || entry === undefined || stop_loss === undefined ||
        take_profit === undefined || !quantity || !result || profit_loss === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { rows } = await pool.query(
      'INSERT INTO trades (user_id, date, time, symbol, direction, entry, stop_loss, take_profit, quantity, result, profit_loss, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [req.user!.userId, date, time, String(symbol).toUpperCase(), String(direction).toUpperCase(),
       Number(entry), Number(stop_loss), Number(take_profit), Number(quantity),
       String(result).toUpperCase(), Number(profit_loss), notes || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// PUT update trade
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM trades WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!existing.length) return res.status(404).json({ error: 'Trade not found' });
    const e = existing[0] as Trade;
    const { date, time, symbol, direction, entry, stop_loss, take_profit, quantity, result, profit_loss, notes } = req.body;
    const { rows } = await pool.query(
      'UPDATE trades SET date=$1,time=$2,symbol=$3,direction=$4,entry=$5,stop_loss=$6,take_profit=$7,quantity=$8,result=$9,profit_loss=$10,notes=$11 WHERE id=$12 AND user_id=$13 RETURNING *',
      [
        date||e.date, time||e.time,
        symbol ? String(symbol).toUpperCase() : e.symbol,
        direction ? String(direction).toUpperCase() : e.direction,
        entry!==undefined ? Number(entry) : e.entry,
        stop_loss!==undefined ? Number(stop_loss) : e.stop_loss,
        take_profit!==undefined ? Number(take_profit) : e.take_profit,
        quantity!==undefined ? Number(quantity) : e.quantity,
        result ? String(result).toUpperCase() : e.result,
        profit_loss!==undefined ? Number(profit_loss) : e.profit_loss,
        notes!==undefined ? notes : e.notes,
        req.params.id, req.user!.userId,
      ]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// DELETE trade
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id FROM trades WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Trade not found' });
    await pool.query('DELETE FROM trades WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

export default router;
