// CLI: create (or update) a user with a properly bcrypt-hashed password.
// Needed because inserting rows by hand (e.g. via pgAdmin) can't produce
// the hash the login flow expects.
//
//   npm run add-user -- <email> <full name> <password>
//   e.g. npm run add-user -- dana@ajaia.test "Dana Kim" hunter2secure
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password) {
  console.error('Usage: npm run add-user -- <email> <full name> <password>');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`"${email}" does not look like an email address.`);
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const user = await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  update: { name, passwordHash: bcrypt.hashSync(password, 10) },
  create: { email: email.toLowerCase(), name, passwordHash: bcrypt.hashSync(password, 10) },
});
console.log(`User ready: ${user.name} <${user.email}> (id ${user.id})`);
await prisma.$disconnect();
