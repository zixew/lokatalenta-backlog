import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express, Request, Response } from 'express';
import { createApp } from '../server/app.ts';
import { openDatabase, seedDatabaseIfEmpty } from '../server/db.ts';

let cachedApp: Express | null = null;

export function createServerlessApp(): Express {
  const db = openDatabase();
  if (
    process.env.BACKLOG_SEED === 'true' ||
    (process.env.VERCEL === '1' && process.env.BACKLOG_SEED !== 'false')
  ) {
    seedDatabaseIfEmpty(db);
  }
  return createApp({
    db,
    staticDir: null,
  });
}

export function getCachedServerlessApp(): Express {
  if (!cachedApp) {
    cachedApp = createServerlessApp();
  }
  return cachedApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const app = getCachedServerlessApp();
  app(req as unknown as Request, res as unknown as Response);
}
