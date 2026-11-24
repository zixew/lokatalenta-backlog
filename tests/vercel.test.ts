import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, isOriginAllowed } from '../server/app.ts';
import { openDatabase, resolveDbPath } from '../server/db.ts';

describe('Vercel Serverless Readiness, /tmp DB Fallback & CORS', () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];
  const servers: http.Server[] = [];
  const dbs: DatabaseSync[] = [];

  afterEach(async () => {
    process.env = { ...originalEnv };
    while (servers.length > 0) {
      const srv = servers.pop()!;
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
    while (dbs.length > 0) {
      dbs.pop()!.close();
    }
  });

  afterAll(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves /tmp/lokatalenta-backlog.db when VERCEL=1 unless DB_PATH or BACKLOG_DB_PATH is set', () => {
    delete process.env.BACKLOG_DB_PATH;
    delete process.env.DB_PATH;
    process.env.VERCEL = '1';

    expect(resolveDbPath()).toBe('/tmp/lokatalenta-backlog.db');

    process.env.DB_PATH = '/tmp/custom-override.db';
    expect(resolveDbPath()).toBe('/tmp/custom-override.db');

    process.env.BACKLOG_DB_PATH = '/tmp/backlog-priority.db';
    expect(resolveDbPath()).toBe('/tmp/backlog-priority.db');
  });

  it('enforces configurable CORS_ORIGINS alongside localhost:*, 127.0.0.1:*, and *.vercel.app', async () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed('http://localhost:4112')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:4103')).toBe(true);
    expect(isOriginAllowed('https://lokatalenta-sprint.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://evilvercel.app')).toBe(false);
    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
    expect(
      isOriginAllowed(
        'https://docs.lokatalenta.id',
        'https://docs.lokatalenta.id, *.preview.lokatalenta.id',
      ),
    ).toBe(true);
    expect(
      isOriginAllowed(
        'https://pr-12.preview.lokatalenta.id',
        'https://docs.lokatalenta.id, *.preview.lokatalenta.id',
      ),
    ).toBe(true);

    const db = openDatabase(':memory:');
    dbs.push(db);
    const app = createApp({
      db,
      gatewayUrl: 'disabled',
      corsOrigins: 'https://custom.lokatalenta.id',
      staticDir: null,
    });
    const server = http.createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Expected TCP address');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const allowedVercel = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://lokatalenta-office.vercel.app' },
    });
    expect(allowedVercel.headers.get('access-control-allow-origin')).toBe(
      'https://lokatalenta-office.vercel.app',
    );

    const allowedCustom = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://custom.lokatalenta.id' },
    });
    expect(allowedCustom.headers.get('access-control-allow-origin')).toBe(
      'https://custom.lokatalenta.id',
    );

    const disallowed = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(disallowed.status).toBe(200);
    expect(disallowed.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('mounts api/index.ts default serverless handler cleanly without calling listen', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-vercel-'));
    tempDirs.push(tmpDir);
    const tempDb = path.join(tmpDir, 'serverless.db');

    process.env.DB_PATH = tempDb;
    process.env.EVENT_GATEWAY_URL = 'disabled';
    delete process.env.BACKLOG_SEED;
    delete process.env.VERCEL;

    vi.resetModules();
    const { default: handler } = await import('../api/index.ts');

    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Expected TCP address');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as { ok: boolean; service: string };
    expect(healthJson.ok).toBe(true);
    expect(healthJson.service).toBe('lokatalenta-backlog');

    const postRes = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'story',
        title: 'Serverless cold start item',
        ownerDivision: 'devops',
        ownerAgentId: 11,
      }),
    });
    expect(postRes.status).toBe(201);

    const listRes = await fetch(`${baseUrl}/api/items`);
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { items: Array<{ id: string }> };
    expect(listJson.items).toHaveLength(1);
    expect(listJson.items[0].id).toBe('BL-001');
  });
});
