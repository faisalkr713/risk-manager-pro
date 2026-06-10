import { Router, Request, Response } from 'express';
import pool from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

interface Broker {
  id: number; user_id: number; name: string; asset_class: string;
  contract_size: number; tick_value: number; tick_size: number;
  leverage: number; commission: number; lot_step: number; is_custom: number; created_at: string;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM brokers WHERE user_id = $1 ORDER BY is_custom ASC, name ASC', [req.user!.userId]);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Failed to fetch brokers' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM brokers WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Broker not found' });
    res.json(rows[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch broker' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step } = req.body;
    if (!name || !asset_class) return res.status(400).json({ error: 'Name and asset class are required' });
    const { rows } = await pool.query(
      'INSERT INTO brokers (user_id, name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step, is_custom) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1) RETURNING *',
      [req.user!.userId, name, asset_class, Number(contract_size)||100000, Number(tick_value)||1, Number(tick_size)||0.0001, Number(leverage)||100, Number(commission)||0, Number(lot_step)||0.01]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ error: 'Failed to create broker' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM brokers WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!existing.length) return res.status(404).json({ error: 'Broker not found' });
    const e = existing[0] as Broker;
    const { name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step } = req.body;
    const { rows } = await pool.query(
      'UPDATE brokers SET name=$1,asset_class=$2,contract_size=$3,tick_value=$4,tick_size=$5,leverage=$6,commission=$7,lot_step=$8 WHERE id=$9 AND user_id=$10 RETURNING *',
      [name||e.name, asset_class||e.asset_class,
       contract_size!==undefined?Number(contract_size):e.contract_size,
       tick_value!==undefined?Number(tick_value):e.tick_value,
       tick_size!==undefined?Number(tick_size):e.tick_size,
       leverage!==undefined?Number(leverage):e.leverage,
       commission!==undefined?Number(commission):e.commission,
       lot_step!==undefined?Number(lot_step):e.lot_step,
       req.params.id, req.user!.userId]
    );
    res.json(rows[0]);
  } catch { res.status(500).json({ error: 'Failed to update broker' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id FROM brokers WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Broker not found' });
    await pool.query('DELETE FROM brokers WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete broker' }); }
});

export default router;
