import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

interface Asset {
  id: number; user_id: number; symbol: string; asset_type: string;
  contract_size: number; tick_size: number; tick_value: number;
  currency: string; leverage: number; created_at: string;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assets WHERE user_id = $1 ORDER BY symbol ASC', [req.user!.userId]);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to fetch assets' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
    res.json(rows[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch asset' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage } = req.body;
    if (!symbol || !asset_type) return res.status(400).json({ error: 'Symbol and asset type are required' });
    const { rows } = await pool.query(
      'INSERT INTO assets (user_id, symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.user!.userId, String(symbol).toUpperCase(), asset_type, Number(contract_size)||1, Number(tick_size)||0.01, Number(tick_value)||1, currency||'USD', Number(leverage)||1]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ error: 'Failed to create asset' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!existing.length) return res.status(404).json({ error: 'Asset not found' });
    const e = existing[0] as Asset;
    const { symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage } = req.body;
    const { rows } = await pool.query(
      'UPDATE assets SET symbol=$1,asset_type=$2,contract_size=$3,tick_size=$4,tick_value=$5,currency=$6,leverage=$7 WHERE id=$8 AND user_id=$9 RETURNING *',
      [symbol?String(symbol).toUpperCase():e.symbol, asset_type||e.asset_type,
       contract_size!==undefined?Number(contract_size):e.contract_size,
       tick_size!==undefined?Number(tick_size):e.tick_size,
       tick_value!==undefined?Number(tick_value):e.tick_value,
       currency||e.currency, leverage!==undefined?Number(leverage):e.leverage,
       req.params.id, req.user!.userId]
    );
    res.json(rows[0]);
  } catch { res.status(500).json({ error: 'Failed to update asset' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Asset not found' });
    await pool.query('DELETE FROM assets WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete asset' }); }
});

export default router;
