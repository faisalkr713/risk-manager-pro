import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool, { seedUserDefaults } from '../database';
import { JWT_SECRET, requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/auth/guest — create an anonymous guest session so the app is usable immediately
router.post('/guest', async (_req: Request, res: Response) => {
  try {
    const rand = crypto.randomBytes(8).toString('hex');
    const email = `guest_${rand}@guest.local`;
    const hash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, is_guest) VALUES ($1, $2, $3, true) RETURNING id, email, name, is_guest, created_at',
      [email, hash, 'Guest']
    );
    const user = result.rows[0];
    await seedUserDefaults(user.id);
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start guest session' });
  }
});

// POST /api/auth/convert — turn the current guest into a real account (keeps all their data)
router.post('/convert', requireAuth, async (req: Request, res: Response) => {
  try {
    const { email, password, name = '' } = req.body as { email?: string; password?: string; name?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered. Please log in instead.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'UPDATE users SET email = $1, password_hash = $2, name = $3, is_guest = false WHERE id = $4 RETURNING id, email, name, is_guest, created_at',
      [email.toLowerCase(), hash, name.trim(), req.user!.userId]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name = '' } = req.body as { email?: string; password?: string; name?: string };
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_guest, created_at',
      [email.toLowerCase(), hash, name.trim()]
    );
    const user = result.rows[0];
    await seedUserDefaults(user.id);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
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

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_guest: user.is_guest, created_at: user.created_at } });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, email, name, is_guest, created_at FROM users WHERE id = $1', [req.user!.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = req.body as { name?: string; currentPassword?: string; newPassword?: string };
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user!.userId]);
    const user = rows[0];

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.userId]);
    }
    if (name !== undefined) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name.trim(), req.user!.userId]);
    }
    const updated = await pool.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [req.user!.userId]);
    res.json({ user: updated.rows[0] });
  } catch {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

export default router;
