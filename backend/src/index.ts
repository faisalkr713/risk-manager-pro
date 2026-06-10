import express from 'express';
import cors from 'cors';
import path from 'path';
import tradesRouter from './routes/trades';
import settingsRouter from './routes/settings';
import assetsRouter from './routes/assets';
import brokersRouter from './routes/brokers';
import pricesRouter from './routes/prices';
import authRouter from './routes/auth';
import { initDb } from './database';
import { startPriceService } from './services/priceService';

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: isProd ? true : 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/brokers', brokersRouter);
app.use('/api/prices', pricesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (isProd) {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

async function start() {
  await initDb();
  startPriceService();
  app.listen(PORT, () => {
    console.log(`Risk Manager Pro backend running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
