import type { Document, ShareRole } from '@prisma/client';
import { prisma } from './db.js';

export type Access = 'owner' | 'editor' | 'viewer';

export const roleToAccess = (role: ShareRole): Access =>
  role === 'VIEWER' ? 'viewer' : 'editor';

/**
 * Returns { doc, access }, or null when the user cannot see the document at
 * all — callers translate that into a 404 so document ids are not probeable.
 */
export async function getDocAccess(
  docId: number,
  userId: number
): Promise<{ doc: Document; access: Access } | null> {
  if (!Number.isInteger(docId)) return null;
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return null;
  if (doc.ownerId === userId) return { doc, access: 'owner' };
  const share = await prisma.share.findUnique({
    where: { documentId_userId: { documentId: docId, userId } },
  });
  if (!share) return null;
  return { doc, access: roleToAccess(share.role) };
}
