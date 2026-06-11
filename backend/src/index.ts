import express from 'express';
import cors from 'cors';
import path from 'path';
import tradesRouter from './routes/trades';
import settingsRouter from './routes/settings';
import assetsRouter from './routes/assets';
import brokersRouter from './routes/brokers';
import pricesRouter from './routes/prices';
import authRouter from './routes/auth';
import paymentsRouter from './routes/payments';
import analyzeRouter from './routes/analyze';
import signalsRouter from './routes/signals';
import { initDb } from './database';
import { startPriceService } from './services/priceService';
import { startSignalService } from './services/signalService';

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
// Webhook needs raw body before json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments', paymentsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/signals', signalsRouter);

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

// Keep the free-tier instance awake by pinging itself before the 15-min idle window.
function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL || (isProd ? 'https://risk-manager-pro.onrender.com' : '');
  if (!url) return;
  setInterval(() => {
    fetch(`${url}/api/health`).catch(() => { /* ignore */ });
  }, 12 * 60 * 1000); // every 12 minutes
  console.log(`Keep-alive enabled → ${url}/api/health every 12 min`);
}

async function start() {
  console.log(`NODE_ENV=${process.env.NODE_ENV}, PORT=${PORT}`);
  console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
  await initDb();
  startPriceService();
  startSignalService();
  app.listen(PORT, () => {
    console.log(`Trade Calculate backend running on port ${PORT}`);
    startKeepAlive();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err.message ?? err);
  process.exit(1);
});

export default app;
