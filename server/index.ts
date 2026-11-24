import fs from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECOSYSTEM_PORTS } from '../shared/contracts.ts';
import { createApp } from './app.ts';
import { openDatabase, seedDatabaseIfEmpty } from './db.ts';

function resolveDefaultStaticDir(): string {
  const fromSource = path.resolve(import.meta.dirname, '..', 'client', 'dist');
  if (fs.existsSync(path.join(fromSource, 'index.html'))) {
    return fromSource;
  }
  const fromDist = path.resolve(import.meta.dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(path.join(fromDist, 'index.html'))) {
    return fromDist;
  }
  return fromSource;
}

export function startServer(): Server {
  const port = Number.parseInt(
    process.env.PORT ?? String(ECOSYSTEM_PORTS.backlog.apiPort),
    10,
  );
  const db = openDatabase();

  if (process.env.BACKLOG_SEED === 'true') {
    const seededCount = seedDatabaseIfEmpty(db);
    if (seededCount > 0) {
      console.log(`[lokatalenta-backlog] Seeded ${seededCount} starter backlog items`);
    }
  }

  const staticDir =
    process.env.STATIC_DIR !== undefined
      ? process.env.STATIC_DIR || null
      : resolveDefaultStaticDir();

  const app = createApp({
    db,
    port,
    staticDir,
  });

  const server = app.listen(port, () => {
    console.log(`[lokatalenta-backlog] API listening on http://localhost:${port}`);
  });

  return server;
}

const isEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  startServer();
}
