import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../database';
import { requireAuth } from '../middleware/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? 'price_1TgtczE2cHorWr2ag8hIPUP0';
export const DONATION_URL = process.env.STRIPE_DONATION_URL ?? 'https://buy.stripe.com/test_5kQ4gzaPN9m83qH2kj9IQ00';

const router = Router();

// GET /api/payments/status — return user plan + usage
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT plan FROM users WHERE id = $1', [req.user!.userId]);
    const user = rows[0];

    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const [tradeRes, analysisRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM trades WHERE user_id = $1 AND created_at >= $2', [req.user!.userId, start]),
      pool.query('SELECT COUNT(*) as c FROM screenshot_analyses WHERE user_id = $1 AND created_at >= $2', [req.user!.userId, start]),
    ]);

    res.json({
      plan: user?.plan ?? 'free',
      monthlyTrades: parseInt(tradeRes.rows[0].c),
      monthlyAnalyses: parseInt(analysisRes.rows[0].c),
      limits: { trades: 30, analyses: 1 },
      donationUrl: DONATION_URL,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch plan status' });
  }
});

// POST /api/payments/create-checkout — create Stripe checkout session
router.post('/create-checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT email, stripe_customer_id FROM users WHERE id = $1', [req.user!.userId]);
    const user = rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.user!.userId]);
    }

    const origin = req.headers.origin ?? 'https://risk-manager-pro.onrender.com';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?upgraded=1`,
      cancel_url: `${origin}/?cancelled=1`,
      metadata: { userId: String(req.user!.userId) },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/payments/portal — billing portal to manage/cancel subscription
router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user!.userId]);
    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'No subscription found' });

    const origin = req.headers.origin ?? 'https://risk-manager-pro.onrender.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /api/payments/webhook — Stripe events
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    return res.status(400).json({ error: 'Webhook signature invalid' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const subId = session.subscription as string;
        if (userId && subId) {
          await pool.query(
            'UPDATE users SET plan = $1, stripe_subscription_id = $2 WHERE id = $3',
            ['pro', subId, parseInt(userId)]
          );
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event.data.object as any;
        await pool.query(
          'UPDATE users SET plan = $1, stripe_subscription_id = NULL WHERE stripe_subscription_id = $2',
          ['free', sub.id]
        );
        break;
      }
      case 'customer.subscription.resumed':
      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event.data.object as any;
        if (sub.status === 'active') {
          await pool.query(
            'UPDATE users SET plan = $1 WHERE stripe_subscription_id = $2',
            ['pro', sub.id]
          );
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
