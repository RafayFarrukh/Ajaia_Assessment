import { createApp } from './app.js';
import { seed } from './seed.js';

const port = Number(process.env.PORT) || 3001;

// Seeding is idempotent — creates demo users (and a welcome doc) if missing.
seed()
  .then(() => {
    createApp().listen(port, () => {
      console.log(`Ajaia Docs server listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
