import { Router, Request, Response } from 'express';
import getDb from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

interface Broker {
  id: number; user_id: number; name: string; asset_class: string;
  contract_size: number; tick_value: number; tick_size: number;
  leverage: number; commission: number; lot_step: number; is_custom: number; created_at: string;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const brokers = getDb().all('SELECT * FROM brokers WHERE user_id = ? ORDER BY is_custom ASC, name ASC', [req.user!.userId]) as unknown as Broker[];
    res.json(brokers);
  } catch { res.status(500).json({ error: 'Failed to fetch brokers' }); }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const broker = getDb().get('SELECT * FROM brokers WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]) as unknown as Broker | undefined;
    if (!broker) return res.status(404).json({ error: 'Broker not found' });
    res.json(broker);
  } catch { res.status(500).json({ error: 'Failed to fetch broker' }); }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step } = req.body;
    if (!name || !asset_class) return res.status(400).json({ error: 'Name and asset class are required' });
    const r = db.run(
      'INSERT INTO brokers (user_id, name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [req.user!.userId, name, asset_class, Number(contract_size)||100000, Number(tick_value)||1, Number(tick_size)||0.0001, Number(leverage)||100, Number(commission)||0, Number(lot_step)||0.01]
    );
    res.status(201).json(db.get('SELECT * FROM brokers WHERE id = ?', [r.lastInsertRowid]));
  } catch { res.status(500).json({ error: 'Failed to create broker' }); }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM brokers WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]) as unknown as Broker | undefined;
    if (!existing) return res.status(404).json({ error: 'Broker not found' });
    const { name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step } = req.body;
    db.run(
      'UPDATE brokers SET name=?,asset_class=?,contract_size=?,tick_value=?,tick_size=?,leverage=?,commission=?,lot_step=? WHERE id=? AND user_id=?',
      [name||existing.name, asset_class||existing.asset_class,
       contract_size!==undefined?Number(contract_size):existing.contract_size,
       tick_value!==undefined?Number(tick_value):existing.tick_value,
       tick_size!==undefined?Number(tick_size):existing.tick_size,
       leverage!==undefined?Number(leverage):existing.leverage,
       commission!==undefined?Number(commission):existing.commission,
       lot_step!==undefined?Number(lot_step):existing.lot_step,
       req.params.id, req.user!.userId]
    );
    res.json(db.get('SELECT * FROM brokers WHERE id = ?', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed to update broker' }); }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT id FROM brokers WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    if (!existing) return res.status(404).json({ error: 'Broker not found' });
    db.run('DELETE FROM brokers WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete broker' }); }
});

export default router;
