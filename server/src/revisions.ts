import { prisma } from './db.js';

// A new snapshot is only written if the newest one is older than this,
// so continuous typing doesn't produce a revision per keystroke burst.
const THROTTLE_MS = Number(process.env.REVISION_THROTTLE_MS ?? 60_000);
const MAX_REVISIONS_PER_DOC = 50;

/** Snapshot the document's current state into its revision history. */
export async function captureRevision(
  doc: { id: number; title: string; content: string },
  authorId: number,
  opts: { force?: boolean } = {}
): Promise<void> {
  if (!opts.force) {
    const latest = await prisma.documentRevision.findFirst({
      where: { documentId: doc.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < THROTTLE_MS) return;
  }

  await prisma.documentRevision.create({
    data: { documentId: doc.id, authorId, title: doc.title, content: doc.content },
  });

  // Cap history per document; drop the oldest beyond the limit.
  const stale = await prisma.documentRevision.findMany({
    where: { documentId: doc.id },
    orderBy: { createdAt: 'desc' },
    skip: MAX_REVISIONS_PER_DOC,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.documentRevision.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
  }
}
