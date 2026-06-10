import { Database as SqliteDatabase } from 'node-sqlite3-wasm';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'risk_manager.db');

let db: SqliteDatabase;

export function getDb(): SqliteDatabase {
  if (!db) {
    db = new SqliteDatabase(DB_PATH);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  // Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings — per user
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Trades — per user
  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Brokers — per user
  db.run(`
    CREATE TABLE IF NOT EXISTS brokers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      contract_size REAL NOT NULL DEFAULT 100000,
      tick_value REAL NOT NULL DEFAULT 1,
      tick_size REAL NOT NULL DEFAULT 0.0001,
      leverage INTEGER NOT NULL DEFAULT 100,
      commission REAL NOT NULL DEFAULT 0,
      lot_step REAL NOT NULL DEFAULT 0.01,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Assets — per user
  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      contract_size REAL NOT NULL DEFAULT 1,
      tick_size REAL NOT NULL DEFAULT 0.01,
      tick_value REAL NOT NULL DEFAULT 1,
      currency TEXT NOT NULL DEFAULT 'USD',
      leverage INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
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

export function seedUserDefaults(userId: number): void {
  const database = getDb();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    database.run(
      'INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)',
      [userId, key, value]
    );
  }
  const count = (database.get('SELECT COUNT(*) as c FROM brokers WHERE user_id = ?', [userId]) as unknown as { c: number }).c;
  if (count === 0) {
    for (const b of DEFAULT_BROKERS) {
      database.run(
        'INSERT INTO brokers (user_id, name, asset_class, contract_size, tick_value, tick_size, leverage, commission, lot_step, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, ...b]
      );
    }
  }
}

export default getDb;
