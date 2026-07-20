import { PrismaClient } from '@prisma/client';

// Zero-config local dev: default to the docker-compose database when no
// DATABASE_URL is provided (tests and deployments always set their own).
process.env.DATABASE_URL ||= 'postgresql://ajaia:ajaia@localhost:5433/ajaia_docs';

export const prisma = new PrismaClient();
