# Alternative deployment path (Railway, Fly.io, any container host).
# Requires a DATABASE_URL env var pointing at Postgres.
FROM node:20-slim

# Prisma engines need OpenSSL on slim images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm install

COPY . .
RUN npx -w server prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
