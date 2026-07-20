import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

// Express's Request is extended so req.user is typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: SessionUser;
    }
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-prod';
const COOKIE_NAME = 'ajaia_session';
const WEEK_SECONDS = 7 * 24 * 60 * 60;

export function setSessionCookie(res: Response, userId: number): void {
  const token = jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: WEEK_SECONDS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: WEEK_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}

/** Attaches req.user or responds 401. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = Number(typeof payload === 'string' ? payload : payload.sub);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}
