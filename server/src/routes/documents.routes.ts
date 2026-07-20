import { Router } from 'express';
import type { ShareRole } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { sanitizeContent } from '../sanitize.js';
import { asyncHandler } from '../asyncHandler.js';
import { getDocAccess, roleToAccess } from '../access.js';
import { captureRevision } from '../revisions.js';
import { markEditing } from '../presence.js';

const router = Router();
router.use(requireAuth);

const MAX_TITLE = 200;
const MAX_CONTENT = 2 * 1024 * 1024; // 2 MB of HTML is plenty for this scope

// List documents, split into owned and shared-with-me.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const owned = await prisma.document.findMany({
      where: { ownerId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    const shares = await prisma.share.findMany({
      where: { userId: req.user.id },
      orderBy: { document: { updatedAt: 'desc' } },
      select: {
        role: true,
        document: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    res.json({
      owned,
      shared: shares.map((s) => ({ ...s.document, role: roleToAccess(s.role) })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || 'Untitled document').slice(0, MAX_TITLE);
    const content = sanitizeContent(String(req.body?.content || '').slice(0, MAX_CONTENT));
    const doc = await prisma.document.create({
      data: { ownerId: req.user.id, title, content },
    });
    res.status(201).json({ doc });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const owner = await prisma.user.findUnique({
      where: { id: result.doc.ownerId },
      select: { id: true, name: true, email: true },
    });
    res.json({
      doc: {
        id: result.doc.id,
        title: result.doc.title,
        content: result.doc.content,
        createdAt: result.doc.createdAt,
        updatedAt: result.doc.updatedAt,
        owner,
      },
      access: result.access,
    });
  })
);

// Update title and/or content. Owners and editors only.
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    if (result.access === 'viewer') {
      return res.status(403).json({ error: 'You have view-only access' });
    }

    const data: { title?: string; content?: string } = {};
    if (typeof req.body?.title === 'string') {
      const title = req.body.title.trim().slice(0, MAX_TITLE);
      if (!title) return res.status(400).json({ error: 'Title cannot be empty' });
      data.title = title;
    }
    if (typeof req.body?.content === 'string') {
      if (req.body.content.length > MAX_CONTENT) {
        return res.status(413).json({ error: 'Document is too large' });
      }
      data.content = sanitizeContent(req.body.content);
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const doc = await prisma.document.update({ where: { id: result.doc.id }, data });
    // Content saves feed version history (throttled inside captureRevision)
    // and flip this user's presence indicator to "editing".
    if (data.content !== undefined) {
      await captureRevision(doc, req.user.id);
      markEditing(doc.id, req.user.id);
    }
    res.json({ doc: { id: doc.id, title: doc.title, updatedAt: doc.updatedAt } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    if (result.access !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can delete a document' });
    }
    await prisma.document.delete({ where: { id: result.doc.id } });
    res.json({ ok: true });
  })
);

// --- Sharing ---

router.get(
  '/:id/shares',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const shares = await prisma.share.findMany({
      where: { documentId: result.doc.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, user: { select: { email: true, name: true } } },
    });
    res.json({
      shares: shares.map((s) => ({
        id: s.id,
        role: roleToAccess(s.role),
        email: s.user.email,
        name: s.user.name,
      })),
    });
  })
);

router.post(
  '/:id/shares',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    if (result.access !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can share a document' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const role: ShareRole = req.body?.role === 'viewer' ? 'VIEWER' : 'EDITOR';
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) return res.status(404).json({ error: `No user with email ${email}` });
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'You already own this document' });
    }

    await prisma.share.upsert({
      where: { documentId_userId: { documentId: result.doc.id, userId: target.id } },
      update: { role },
      create: { documentId: result.doc.id, userId: target.id, role },
    });
    res.status(201).json({
      share: { email: target.email, name: target.name, role: roleToAccess(role) },
    });
  })
);

router.delete(
  '/:id/shares/:shareId',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    if (result.access !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can manage sharing' });
    }
    const { count } = await prisma.share.deleteMany({
      where: { id: Number(req.params.shareId), documentId: result.doc.id },
    });
    if (!count) return res.status(404).json({ error: 'Share not found' });
    res.json({ ok: true });
  })
);

export default router;
