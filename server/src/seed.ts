import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

export const SEED_USERS = [
  { email: 'alice@ajaia.test', name: 'Alice Rivera', password: 'password123' },
  { email: 'bob@ajaia.test', name: 'Bob Chen', password: 'password123' },
  { email: 'carol@ajaia.test', name: 'Carol Okafor', password: 'password123' },
];

export async function seed(): Promise<void> {
  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, passwordHash: bcrypt.hashSync(u.password, 10) },
    });
  }

  // Give Alice a welcome document on first boot so the app never opens empty.
  const docCount = await prisma.document.count();
  if (docCount === 0) {
    const alice = await prisma.user.findUnique({ where: { email: SEED_USERS[0]!.email } });
    if (alice) {
      await prisma.document.create({
        data: {
          ownerId: alice.id,
          title: 'Welcome to Ajaia Docs',
          content:
            '<h1>Welcome to Ajaia Docs</h1><p>This is a lightweight collaborative editor. Try <strong>bold</strong>, <em>italic</em>, <u>underline</u>, headings and lists from the toolbar.</p><ul><li>Create documents from the home screen</li><li>Import a .txt, .md or .docx file</li><li>Share this doc with bob@ajaia.test</li></ul>',
        },
      });
    }
  }
}

// Allow `npm run seed` / `prisma db seed` to work as a standalone script.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log('Seeded users:', SEED_USERS.map((u) => u.email).join(', '));
      return prisma.$disconnect();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
