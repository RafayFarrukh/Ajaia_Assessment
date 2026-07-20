import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { getDocAccess } from '../access.js';
import { captureRevision } from '../revisions.js';
import { heartbeat, leave } from '../presence.js';

// Collaboration surfaces: version history, comments, presence.
const router = Router();
router.use(requireAuth);

const MAX_COMMENT = 2000;

// --- Version history ---

router.get(
  '/:id/revisions',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const revisions = await prisma.documentRevision.findMany({
      where: { documentId: result.doc.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
    res.json({
      revisions: revisions.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.createdAt,
        authorName: r.author?.name ?? 'Unknown',
      })),
    });
  })
);

router.post(
  '/:id/revisions/:revId/restore',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    if (result.access === 'viewer') {
      return res.status(403).json({ error: 'You have view-only access' });
    }
    const revision = await prisma.documentRevision.findFirst({
      where: { id: Number(req.params.revId), documentId: result.doc.id },
    });
    if (!revision) return res.status(404).json({ error: 'Revision not found' });

    // Snapshot the current state first so a restore is itself reversible.
    await captureRevision(result.doc, req.user.id, { force: true });
    const doc = await prisma.document.update({
      where: { id: result.doc.id },
      data: { title: revision.title, content: revision.content },
    });
    res.json({ doc: { id: doc.id, title: doc.title, content: doc.content } });
  })
);

// --- Comments (document-level; any collaborator can comment) ---

router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const comments = await prisma.comment.findMany({
      where: { documentId: result.doc.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    res.json({ comments });
  })
);

router.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const body = String(req.body?.body ?? '').trim();
    if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
    if (body.length > MAX_COMMENT) {
      return res.status(400).json({ error: `Comment is too long (max ${MAX_COMMENT} chars)` });
    }
    const comment = await prisma.comment.create({
      data: { documentId: result.doc.id, authorId: req.user.id, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ comment });
  })
);

router.delete(
  '/:id/comments/:commentId',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const comment = await prisma.comment.findFirst({
      where: { id: Number(req.params.commentId), documentId: result.doc.id },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    // Only the comment's author or the document owner may delete it.
    if (comment.authorId !== req.user.id && result.access !== 'owner') {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    await prisma.comment.delete({ where: { id: comment.id } });
    res.json({ ok: true });
  })
);

// --- Presence ---

router.post(
  '/:id/presence',
  asyncHandler(async (req, res) => {
    const result = await getDocAccess(Number(req.params.id), req.user.id);
    if (!result) return res.status(404).json({ error: 'Document not found' });
    const active = heartbeat(result.doc.id, req.user.id);
    const users = await prisma.user.findMany({
      where: { id: { in: active.map((a) => a.userId) } },
      select: { id: true, name: true, email: true },
    });
    const editingIds = new Set(active.filter((a) => a.editing).map((a) => a.userId));
    res.json({
      viewers: users.map((u) => ({ ...u, editing: editingIds.has(u.id) })),
    });
  })
);

router.delete(
  '/:id/presence',
  asyncHandler(async (req, res) => {
    // No access check needed: leaving presence for a doc you can't see is a no-op.
    leave(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  })
);

export default router;
