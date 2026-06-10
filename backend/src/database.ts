import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      quantity REAL NOT NULL,
      result TEXT NOT NULL,
      profit_loss REAL NOT NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brokers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      contract_size REAL NOT NULL DEFAULT 100000,
      tick_value REAL NOT NULL DEFAULT 1,
      tick_size REAL NOT NULL DEFAULT 0.0001,
      leverage INTEGER NOT NULL DEFAULT 100,
      commission REAL NOT NULL DEFAULT 0,
      lot_step REAL NOT NULL DEFAULT 0.01,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      contract_size REAL NOT NULL DEFAULT 1,
      tick_size REAL NOT NULL DEFAULT 0.01,
      tick_value REAL NOT NULL DEFAULT 1,
      currency TEXT NOT NULL DEFAULT 'USD',
      leverage INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log('Database schema ready');
}

export const DEFAULT_SETTINGS: Record<string, string> = {
  balance: '10000',
  daily_target: '200',
  daily_loss_limit: '100',
  risk_per_trade: '20',
  max_trades_per_day: '4',
  max_consecutive_losses: '2',
  min_rr_ratio: '2',
  discipline_mode_enabled: 'true',
};

export const DEFAULT_BROKERS = [
  ['OKX',         'Crypto', 1,      0.01, 0.01,   10,   0.05,  0.001, 0],
  ['Bybit',       'Crypto', 1,      0.01, 0.01,   10,   0.055, 0.001, 0],
  ['Binance',     'Crypto', 1,      0.01, 0.01,   10,   0.04,  0.001, 0],
  ['Exness',      'Forex',  100000, 10,   0.0001, 2000, 0,     0.01,  0],
  ['IC Markets',  'Forex',  100000, 10,   0.0001, 500,  3.5,   0.01,  0],
  ['Pepperstone', 'Forex',  100000, 10,   0.0001, 200,  3.5,   0.01,  0],
];

export async function seedUserDefaults(userId: number): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.query(
      'INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO NOTHING',
      [userId, key, value]
    );
  }
  const { rows } = await pool.query('SELECT COUNT(*) as c FROM brokers WHERE user_id = $1', [userId]);
  if (parseInt(rows[0].c) === 0) {
    for (const b of DEFAULT_BROKERS) {
      await pool.query(
        'INSERT INTO brokers (user_id, name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step, is_custom) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [userId, ...b]
      );
    }
  }
}

export default pool;
