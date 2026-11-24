import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { openDatabase } from '../server/db.ts';

describe('Static Asset Serving & Express 5 SPA Fallback', () => {
  const tempDirs: string[] = [];
  let server: http.Server | null = null;
  let db: DatabaseSync | null = null;

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    db?.close();
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('serves static assets & SPA fallback for non-API paths while returning JSON 404 for /api/*', async () => {
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-spa-'));
    tempDirs.push(staticDir);
    fs.mkdirSync(path.join(staticDir, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(staticDir, 'index.html'),
      '<!doctype html><html><body><div id="root">SPA</div></body></html>',
    );
    fs.writeFileSync(
      path.join(staticDir, 'assets', 'app.js'),
      'console.log("lokatalenta-backlog");',
    );

    db = openDatabase(':memory:');
    const app = createApp({
      db,
      gatewayUrl: 'disabled',
      staticDir,
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Expected TCP address');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const rootRes = await fetch(`${baseUrl}/`);
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('content-type')).toContain('text/html');
    expect(await rootRes.text()).toContain('SPA');

    const kanbanRes = await fetch(`${baseUrl}/kanban`);
    expect(kanbanRes.status).toBe(200);
    expect(kanbanRes.headers.get('content-type')).toContain('text/html');
    expect(await kanbanRes.text()).toContain('SPA');

    const itemRouteRes = await fetch(`${baseUrl}/items/BL-001`);
    expect(itemRouteRes.status).toBe(200);
    expect(itemRouteRes.headers.get('content-type')).toContain('text/html');

    const assetRes = await fetch(`${baseUrl}/assets/app.js`);
    expect(assetRes.status).toBe(200);
    expect(assetRes.headers.get('content-type')).toContain('javascript');
    expect(await assetRes.text()).toContain('lokatalenta-backlog');

    const api404Res = await fetch(`${baseUrl}/api/nonexistent`);
    expect(api404Res.status).toBe(404);
    expect(api404Res.headers.get('content-type')).toContain('application/json');
    const api404Json = (await api404Res.json()) as { error: string };
    expect(api404Json.error).toBe('API route not found');
  });
});
