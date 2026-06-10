import { Router, Request, Response } from 'express';
import getDb from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

interface Asset {
  id: number; user_id: number; symbol: string; asset_type: string;
  contract_size: number; tick_size: number; tick_value: number;
  currency: string; leverage: number; created_at: string;
}

router.get('/', (req: Request, res: Response) => {
  try {
    res.json(getDb().all('SELECT * FROM assets WHERE user_id = ? ORDER BY symbol ASC', [req.user!.userId]));
  } catch { res.status(500).json({ error: 'Failed to fetch assets' }); }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const asset = getDb().get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]) as unknown as Asset | undefined;
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
  } catch { res.status(500).json({ error: 'Failed to fetch asset' }); }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage } = req.body;
    if (!symbol || !asset_type) return res.status(400).json({ error: 'Symbol and asset type are required' });
    const r = db.run(
      'INSERT INTO assets (user_id, symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user!.userId, String(symbol).toUpperCase(), asset_type, Number(contract_size)||1, Number(tick_size)||0.01, Number(tick_value)||1, currency||'USD', Number(leverage)||1]
    );
    res.status(201).json(db.get('SELECT * FROM assets WHERE id = ?', [r.lastInsertRowid]));
  } catch { res.status(500).json({ error: 'Failed to create asset' }); }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]) as unknown as Asset | undefined;
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    const { symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage } = req.body;
    db.run(
      'UPDATE assets SET symbol=?,asset_type=?,contract_size=?,tick_size=?,tick_value=?,currency=?,leverage=? WHERE id=? AND user_id=?',
      [symbol?String(symbol).toUpperCase():existing.symbol, asset_type||existing.asset_type,
       contract_size!==undefined?Number(contract_size):existing.contract_size,
       tick_size!==undefined?Number(tick_size):existing.tick_size,
       tick_value!==undefined?Number(tick_value):existing.tick_value,
       currency||existing.currency, leverage!==undefined?Number(leverage):existing.leverage,
       req.params.id, req.user!.userId]
    );
    res.json(db.get('SELECT * FROM assets WHERE id = ?', [req.params.id]));
  } catch { res.status(500).json({ error: 'Failed to update asset' }); }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db.get('SELECT id FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId])) return res.status(404).json({ error: 'Asset not found' });
    db.run('DELETE FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete asset' }); }
});

export default router;
