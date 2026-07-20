import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { marked } from 'marked';
import mammoth from 'mammoth';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { sanitizeContent } from '../sanitize.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();
router.use(requireAuth);

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

const SUPPORTED = ['.txt', '.md', '.docx'];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function fileToHtml(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.txt') {
    return escapeHtml(file.buffer.toString('utf8'))
      .split(/\r?\n\r?\n/)
      .filter((block) => block.trim())
      .map((block) => `<p>${block.replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
  }
  if (ext === '.md') {
    return marked.parse(file.buffer.toString('utf8'), { async: false });
  }
  if (ext === '.docx') {
    const { value } = await mammoth.convertToHtml({ buffer: file.buffer });
    return value;
  }
  throw Object.assign(
    new Error(`Unsupported file type "${ext}". Supported: ${SUPPORTED.join(', ')}`),
    { status: 400 }
  );
}

// Import a file as a brand-new editable document owned by the caller.
router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const html = sanitizeContent(await fileToHtml(req.file));
    const title =
      path.basename(req.file.originalname, path.extname(req.file.originalname)).slice(0, 200) ||
      'Imported document';
    const doc = await prisma.document.create({
      data: { ownerId: req.user.id, title, content: html },
    });
    res.status(201).json({ doc: { id: doc.id, title: doc.title } });
  })
);

export default router;
