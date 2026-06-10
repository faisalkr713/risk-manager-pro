import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool, { getMonthlyAnalysisCount } from '../database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.post('/', async (req: Request, res: Response) => {
  try {
    // Check plan limits
    const { rows } = await pool.query('SELECT plan FROM users WHERE id = $1', [req.user!.userId]);
    const plan = rows[0]?.plan ?? 'free';

    if (plan === 'free') {
      const count = await getMonthlyAnalysisCount(req.user!.userId);
      if (count >= 1) {
        return res.status(403).json({
          error: 'Free plan limit reached',
          limitReached: true,
          message: 'Free plan allows 1 screenshot analysis per month. Upgrade to Pro for unlimited.',
        });
      }
    }

    const { imageBase64, mimeType = 'image/png' } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Screenshot analyzer not configured. Add ANTHROPIC_API_KEY to enable.' });
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: imageBase64 },
          },
          {
            type: 'text',
            text: `You are an expert trading coach analyzing a trading screenshot. Analyze this chart/trade screenshot and provide:

1. **Market Structure**: What does the price action show? (trend, consolidation, reversal?)
2. **Key Levels**: Identify any visible support/resistance levels
3. **Trade Setup Quality**: If there's a trade entry visible, rate the setup (1-10) and explain why
4. **Risk Assessment**: What are the risks of this setup?
5. **Recommendation**: What action would you take and why?
6. **Discipline Check**: Does this trade follow good risk management principles?

Be concise, direct, and actionable. Format with clear sections.`,
          },
        ],
      }],
    });

    const analysis = message.content[0].type === 'text' ? message.content[0].text : 'Analysis failed';

    // Save to DB for usage tracking
    await pool.query(
      'INSERT INTO screenshot_analyses (user_id, analysis) VALUES ($1, $2)',
      [req.user!.userId, analysis]
    );

    res.json({ analysis });
  } catch (err) {
    console.error('Screenshot analysis error:', err);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

export default router;
