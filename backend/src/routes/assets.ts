import { Router, Request, Response } from 'express';
import getDb from '../database';

const router = Router();

interface Asset {
  id: number;
  symbol: string;
  asset_type: string;
  contract_size: number;
  tick_size: number;
  tick_value: number;
  currency: string;
  leverage: number;
  created_at: string;
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const assets = db.all('SELECT * FROM assets ORDER BY symbol ASC') as unknown as Asset[];
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const asset = db.get('SELECT * FROM assets WHERE id = ?', [req.params.id]) as unknown as Asset | undefined;
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage } = req.body;
    if (!symbol || !asset_type) return res.status(400).json({ error: 'Symbol and asset type are required' });

    const r = db.run(
      'INSERT INTO assets (symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [String(symbol).toUpperCase(), asset_type, Number(contract_size) || 1,
       Number(tick_size) || 0.01, Number(tick_value) || 1, currency || 'USD', Number(leverage) || 1]
    );

    const newAsset = db.get('SELECT * FROM assets WHERE id = ?', [r.lastInsertRowid]) as unknown as Asset;
    res.status(201).json(newAsset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM assets WHERE id = ?', [req.params.id]) as unknown as Asset | undefined;
    if (!existing) return res.status(404).json({ error: 'Asset not found' });

    const { symbol, asset_type, contract_size, tick_size, tick_value, currency, leverage } = req.body;
    db.run(
      'UPDATE assets SET symbol=?, asset_type=?, contract_size=?, tick_size=?, tick_value=?, currency=?, leverage=? WHERE id=?',
      [
        symbol ? String(symbol).toUpperCase() : existing.symbol,
        asset_type || existing.asset_type,
        contract_size !== undefined ? Number(contract_size) : existing.contract_size,
        tick_size !== undefined ? Number(tick_size) : existing.tick_size,
        tick_value !== undefined ? Number(tick_value) : existing.tick_value,
        currency || existing.currency,
        leverage !== undefined ? Number(leverage) : existing.leverage,
        req.params.id,
      ]
    );

    const updated = db.get('SELECT * FROM assets WHERE id = ?', [req.params.id]) as unknown as Asset;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM assets WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    db.run('DELETE FROM assets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

export default router;
