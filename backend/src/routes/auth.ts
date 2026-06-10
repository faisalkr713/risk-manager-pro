import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import getDb, { seedUserDefaults } from '../database';
import { JWT_SECRET, requireAuth } from '../middleware/auth';

const router = Router();

interface UserRow { id: number; email: string; password_hash: string; name: string; created_at: string; }

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name = '' } = req.body as { email?: string; password?: string; name?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = getDb();
    const existing = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = db.run(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email.toLowerCase(), hash, name.trim()]
    );
    const userId = result.lastInsertRowid as number;
    seedUserDefaults(userId);

    const token = jwt.sign({ userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
    const user = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [userId]) as unknown as Omit<UserRow, 'password_hash'>;
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const db = getDb();
    const user = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]) as unknown as UserRow | undefined;
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const user = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user!.userId]) as unknown as Omit<UserRow, 'password_hash'> | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = req.body as { name?: string; currentPassword?: string; newPassword?: string };
    const db = getDb();
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.user!.userId]) as unknown as UserRow;

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      const hash = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.userId]);
    }

    if (name !== undefined) {
      db.run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user!.userId]);
    }

    const updated = db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user!.userId]) as unknown as Omit<UserRow, 'password_hash'>;
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

export default router;
