import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';
import { prisma } from '../src/db.js';

// vitest.config.ts points DATABASE_URL at ajaia_docs_test and the global
// setup resets its schema, so tests never touch real data.
const app = createApp();

async function login(email: string): Promise<TestAgent> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(200);
  return agent;
}

let alice: TestAgent;
let bob: TestAgent;

beforeAll(async () => {
  // Start from a clean slate in the dedicated test database.
  await prisma.share.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
  await seed();
  alice = await login('alice@ajaia.test');
  bob = await login('bob@ajaia.test');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth', () => {
  it('rejects bad credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@ajaia.test', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects malformed login payloads', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 42 });
    expect(res.status).toBe(400);
  });

  it('blocks unauthenticated access to documents', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });
});

describe('documents', () => {
  it('creates, reads, renames and edits a document', async () => {
    const created = await alice
      .post('/api/documents')
      .send({ title: 'Spec draft', content: '<p>Hello</p>' });
    expect(created.status).toBe(201);
    const id = created.body.doc.id;

    const fetched = await alice.get(`/api/documents/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.doc.title).toBe('Spec draft');
    expect(fetched.body.doc.content).toBe('<p>Hello</p>');
    expect(fetched.body.access).toBe('owner');

    const patched = await alice
      .patch(`/api/documents/${id}`)
      .send({ title: 'Spec v2', content: '<h1>Head</h1><p><strong>bold</strong></p>' });
    expect(patched.status).toBe(200);

    const refetched = await alice.get(`/api/documents/${id}`);
    expect(refetched.body.doc.title).toBe('Spec v2');
    expect(refetched.body.doc.content).toContain('<strong>bold</strong>');
  });

  it('rejects an empty title', async () => {
    const created = await alice.post('/api/documents').send({ title: 'T' });
    const res = await alice
      .patch(`/api/documents/${created.body.doc.id}`)
      .send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('strips script tags from stored content (XSS)', async () => {
    const created = await alice
      .post('/api/documents')
      .send({ content: '<p>ok</p><script>alert(1)</script>' });
    const fetched = await alice.get(`/api/documents/${created.body.doc.id}`);
    expect(fetched.body.doc.content).not.toContain('<script>');
    expect(fetched.body.doc.content).toContain('<p>ok</p>');
  });

  it('preserves rich formatting (highlight, task list, alignment, links) through sanitization', async () => {
    const rich =
      '<p style="text-align: center">centered</p>' +
      '<p><mark>hi</mark> <a href="https://ajaia.com" target="_blank" rel="noopener">site</a></p>' +
      '<ul data-type="taskList"><li data-checked="true" data-type="taskItem">' +
      '<label><input type="checkbox" checked></label><div><p>done item</p></div></li></ul>';
    const created = await alice.post('/api/documents').send({ content: rich });
    const fetched = await alice.get(`/api/documents/${created.body.doc.id}`);
    const stored = fetched.body.doc.content;
    expect(stored).toContain('text-align:center');
    expect(stored).toContain('<mark>hi</mark>');
    expect(stored).toContain('href="https://ajaia.com"');
    expect(stored).toContain('data-type="taskList"');
    expect(stored).toContain('data-checked="true"');
  });

  it('strips dangerous styles and javascript: links', async () => {
    const evil =
      '<p style="position:fixed;background:url(x)">styled</p>' +
      '<a href="javascript:alert(1)">click</a>';
    const created = await alice.post('/api/documents').send({ content: evil });
    const fetched = await alice.get(`/api/documents/${created.body.doc.id}`);
    const stored = fetched.body.doc.content;
    expect(stored).not.toContain('position');
    expect(stored).not.toContain('javascript:');
    expect(stored).toContain('styled');
  });

  it('hides other users’ documents (404, not 403, to avoid leaking existence)', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Private' });
    const res = await bob.get(`/api/documents/${created.body.doc.id}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-numeric document id', async () => {
    const res = await alice.get('/api/documents/not-a-number');
    expect(res.status).toBe(404);
  });
});

describe('sharing', () => {
  it('grants access, appears in shared list, and respects viewer role', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Roadmap' });
    const id = created.body.doc.id;

    const share = await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'bob@ajaia.test', role: 'viewer' });
    expect(share.status).toBe(201);

    const list = await bob.get('/api/documents');
    const sharedIds = list.body.shared.map((d: { id: number }) => d.id);
    expect(sharedIds).toContain(id);
    expect(list.body.owned.map((d: { id: number }) => d.id)).not.toContain(id);

    const read = await bob.get(`/api/documents/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.access).toBe('viewer');

    const write = await bob.patch(`/api/documents/${id}`).send({ title: 'Hacked' });
    expect(write.status).toBe(403);
  });

  it('lets an editor edit but not delete or re-share', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Notes' });
    const id = created.body.doc.id;
    await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'bob@ajaia.test', role: 'editor' });

    const write = await bob
      .patch(`/api/documents/${id}`)
      .send({ content: '<p>edited by bob</p>' });
    expect(write.status).toBe(200);

    expect((await bob.delete(`/api/documents/${id}`)).status).toBe(403);
    const reshare = await bob
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'carol@ajaia.test' });
    expect(reshare.status).toBe(403);
  });

  it('rejects sharing with an unknown email or with yourself', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Solo' });
    const id = created.body.doc.id;
    const unknown = await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'nobody@ajaia.test' });
    expect(unknown.status).toBe(404);
    const self = await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'alice@ajaia.test' });
    expect(self.status).toBe(400);
  });

  it('revoking a share removes access', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Temp' });
    const id = created.body.doc.id;
    await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'bob@ajaia.test' });

    const shares = await alice.get(`/api/documents/${id}/shares`);
    const shareId = shares.body.shares[0].id;
    const revoke = await alice.delete(`/api/documents/${id}/shares/${shareId}`);
    expect(revoke.status).toBe(200);

    expect((await bob.get(`/api/documents/${id}`)).status).toBe(404);
  });
});

describe('version history', () => {
  it('captures a revision on content save and restores it', async () => {
    const created = await alice
      .post('/api/documents')
      .send({ title: 'Versioned', content: '<p>v1</p>' });
    const id = created.body.doc.id;

    await alice.patch(`/api/documents/${id}`).send({ content: '<p>v2</p>' });

    const list = await alice.get(`/api/documents/${id}/revisions`);
    expect(list.status).toBe(200);
    expect(list.body.revisions.length).toBeGreaterThanOrEqual(1);
    const revId = list.body.revisions[list.body.revisions.length - 1].id;

    const restored = await alice.post(`/api/documents/${id}/revisions/${revId}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.doc.content).toBe('<p>v2</p>');
  });

  it('blocks viewers from restoring', async () => {
    const created = await alice
      .post('/api/documents')
      .send({ title: 'Locked history', content: '<p>a</p>' });
    const id = created.body.doc.id;
    await alice.patch(`/api/documents/${id}`).send({ content: '<p>b</p>' });
    await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'bob@ajaia.test', role: 'viewer' });

    const list = await bob.get(`/api/documents/${id}/revisions`);
    expect(list.status).toBe(200); // viewers can see history
    const revId = list.body.revisions[0].id;
    const restore = await bob.post(`/api/documents/${id}/revisions/${revId}/restore`);
    expect(restore.status).toBe(403);
  });
});

describe('comments', () => {
  it('lets collaborators comment; author or owner can delete', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Discussed' });
    const id = created.body.doc.id;
    await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'bob@ajaia.test', role: 'viewer' });

    const added = await bob
      .post(`/api/documents/${id}/comments`)
      .send({ body: 'Looks good to me' });
    expect(added.status).toBe(201);

    const list = await alice.get(`/api/documents/${id}/comments`);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].author.name).toBe('Bob Chen');

    // Owner may delete someone else's comment.
    const del = await alice.delete(
      `/api/documents/${id}/comments/${added.body.comment.id}`
    );
    expect(del.status).toBe(200);
  });

  it('rejects empty comments and non-collaborators', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Quiet' });
    const id = created.body.doc.id;
    expect(
      (await alice.post(`/api/documents/${id}/comments`).send({ body: '  ' })).status
    ).toBe(400);
    expect(
      (await bob.post(`/api/documents/${id}/comments`).send({ body: 'hi' })).status
    ).toBe(404);
  });
});

describe('presence', () => {
  it('reports active viewers of a shared document', async () => {
    const created = await alice.post('/api/documents').send({ title: 'Busy doc' });
    const id = created.body.doc.id;
    await alice
      .post(`/api/documents/${id}/shares`)
      .send({ email: 'bob@ajaia.test', role: 'editor' });

    await alice.post(`/api/documents/${id}/presence`);
    const seen = await bob.post(`/api/documents/${id}/presence`);
    expect(seen.status).toBe(200);
    const names = seen.body.viewers.map((v: { name: string }) => v.name).sort();
    expect(names).toEqual(['Alice Rivera', 'Bob Chen']);

    // Nobody has saved content yet → everyone is just viewing.
    expect(seen.body.viewers.every((v: { editing: boolean }) => !v.editing)).toBe(true);

    // After Bob saves content, his presence flips to "editing".
    await bob.patch(`/api/documents/${id}`).send({ content: '<p>typing…</p>' });
    const afterEdit = await alice.post(`/api/documents/${id}/presence`);
    const bobEntry = afterEdit.body.viewers.find((v: { name: string }) => v.name === 'Bob Chen');
    expect(bobEntry.editing).toBe(true);
    const aliceEntry = afterEdit.body.viewers.find(
      (v: { name: string }) => v.name === 'Alice Rivera'
    );
    expect(aliceEntry.editing).toBe(false);

    await alice.delete(`/api/documents/${id}/presence`);
    const after = await bob.post(`/api/documents/${id}/presence`);
    expect(after.body.viewers.map((v: { name: string }) => v.name)).toEqual(['Bob Chen']);
  });
});

describe('file import', () => {
  it('imports a markdown file as a new document', async () => {
    const res = await alice
      .post('/api/upload/import')
      .attach(
        'file',
        Buffer.from('# Title\n\nSome **bold** text\n\n- item one\n- item two'),
        'meeting-notes.md'
      );
    expect(res.status).toBe(201);
    expect(res.body.doc.title).toBe('meeting-notes');

    const doc = await alice.get(`/api/documents/${res.body.doc.id}`);
    expect(doc.body.doc.content).toContain('<h1>');
    expect(doc.body.doc.content).toContain('<strong>bold</strong>');
    expect(doc.body.doc.content).toContain('<li>');
  });

  it('imports a plain text file, escaping HTML', async () => {
    const res = await alice
      .post('/api/upload/import')
      .attach('file', Buffer.from('First para\n\n<b>not bold</b>'), 'notes.txt');
    expect(res.status).toBe(201);
    const doc = await alice.get(`/api/documents/${res.body.doc.id}`);
    expect(doc.body.doc.content).toContain('<p>First para</p>');
    expect(doc.body.doc.content).not.toContain('<b>');
  });

  it('rejects unsupported file types', async () => {
    const res = await alice
      .post('/api/upload/import')
      .attach('file', Buffer.from('fake'), 'image.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });
});
