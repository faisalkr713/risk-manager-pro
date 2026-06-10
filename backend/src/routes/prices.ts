import { Router } from 'express';
import { getPriceCache, getPrice } from '../services/priceService';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getPriceCache());
});

router.get('/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const cached = getPrice(symbol);
  if (cached) {
    res.json({ symbol, ...cached, age: Date.now() - cached.timestamp });
  } else {
    res.status(404).json({ error: 'Symbol not found', symbol });
  }
});

export default router;
