import { Router, Request, Response } from 'express';
import getDb from '../database';

const router = Router();

interface Broker {
  id: number;
  name: string;
  asset_class: string;
  contract_size: number;
  tick_value: number;
  tick_size: number;
  leverage: number;
  commission: number;
  lot_step: number;
  is_custom: number;
  created_at: string;
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const brokers = db.all('SELECT * FROM brokers ORDER BY is_custom ASC, name ASC') as unknown as Broker[];
    res.json(brokers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch brokers' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const broker = db.get('SELECT * FROM brokers WHERE id = ?', [req.params.id]) as unknown as Broker | undefined;
    if (!broker) return res.status(404).json({ error: 'Broker not found' });
    res.json(broker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch broker' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step } = req.body;
    if (!name || !asset_class) return res.status(400).json({ error: 'Name and asset class are required' });

    const r = db.run(
      'INSERT INTO brokers (name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [name, asset_class, Number(contract_size) || 100000, Number(tick_value) || 1,
       Number(tick_size) || 0.0001, Number(leverage) || 100, Number(commission) || 0, Number(lot_step) || 0.01]
    );

    const newBroker = db.get('SELECT * FROM brokers WHERE id = ?', [r.lastInsertRowid]) as unknown as Broker;
    res.status(201).json(newBroker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create broker' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM brokers WHERE id = ?', [req.params.id]) as unknown as Broker | undefined;
    if (!existing) return res.status(404).json({ error: 'Broker not found' });

    const { name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step } = req.body;
    db.run(
      'UPDATE brokers SET name=?, asset_class=?, contract_size=?, tick_value=?, tick_size=?, leverage=?, commission=?, lot_step=? WHERE id=?',
      [
        name || existing.name, asset_class || existing.asset_class,
        contract_size !== undefined ? Number(contract_size) : existing.contract_size,
        tick_value !== undefined ? Number(tick_value) : existing.tick_value,
        tick_size !== undefined ? Number(tick_size) : existing.tick_size,
        leverage !== undefined ? Number(leverage) : existing.leverage,
        commission !== undefined ? Number(commission) : existing.commission,
        lot_step !== undefined ? Number(lot_step) : existing.lot_step,
        req.params.id,
      ]
    );

    const updated = db.get('SELECT * FROM brokers WHERE id = ?', [req.params.id]) as unknown as Broker;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update broker' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.get('SELECT * FROM brokers WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Broker not found' });
    db.run('DELETE FROM brokers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete broker' });
  }
});

export default router;
