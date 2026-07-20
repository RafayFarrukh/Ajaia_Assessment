import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireAuth, setSessionCookie, clearSessionCookie } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    setSessionCookie(res, user.id);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  })
);

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Exposed so the login screen can list demo accounts — acceptable for this
// assignment's seeded-user auth model, not something a real product would do.
router.get(
  '/demo-users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { email: true, name: true },
      orderBy: { id: 'asc' },
    });
    res.json({ users });
  })
);

export default router;
