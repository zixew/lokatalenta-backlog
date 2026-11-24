import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { openDatabase } from '../server/db.ts';

const REQUIRED_EVENT_KEYS = [
  'agentId',
  'divisionId',
  'entityId',
  'id',
  'metadata',
  'severity',
  'source',
  'summary',
  'targetFloor',
  'targetZone',
  'timestamp',
  'title',
  'type',
];

describe('Event Gateway Emitter & Fail-Open Resilience', () => {
  const servers: http.Server[] = [];
  const dbs: DatabaseSync[] = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const srv = servers.pop()!;
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
    while (dbs.length > 0) {
      dbs.pop()!.close();
    }
  });

  it('emits strict 13-key event-schema.json payload with HMAC-SHA256 & Bearer headers when secret set', async () => {
    const received: Array<{
      headers: http.IncomingHttpHeaders;
      rawBody: string;
      parsed: Record<string, unknown>;
    }> = [];

    const mockGateway = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        received.push({
          headers: req.headers,
          rawBody,
          parsed: JSON.parse(rawBody) as Record<string, unknown>,
        });
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    servers.push(mockGateway);
    await new Promise<void>((resolve) =>
      mockGateway.listen(0, '127.0.0.1', () => resolve()),
    );
    const gwAddr = mockGateway.address();
    if (!gwAddr || typeof gwAddr === 'string') throw new Error('Expected TCP address');

    const secret = 'super-secret-token';
    const db = openDatabase(':memory:');
    dbs.push(db);

    const app = createApp({
      db,
      gatewayUrl: `http://127.0.0.1:${gwAddr.port}`,
      gatewaySecret: secret,
      staticDir: null,
    });
    const apiServer = http.createServer(app);
    servers.push(apiServer);
    await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', () => resolve()));
    const apiAddr = apiServer.address();
    if (!apiAddr || typeof apiAddr === 'string') throw new Error('Expected TCP address');
    const apiBase = `http://127.0.0.1:${apiAddr.port}`;

    // Create -> backlog.created
    const createRes = await fetch(`${apiBase}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'BL-077',
        type: 'story',
        title: 'Telemetry test item',
        ownerDivision: 'lounge',
        ownerAgentId: 13,
      }),
    });
    expect(createRes.status).toBe(201);

    // Groom -> backlog.groomed
    const groomRes = await fetch(`${apiBase}/api/items/BL-077`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' }),
    });
    expect(groomRes.status).toBe(200);

    // Delete -> backlog.deleted
    const deleteRes = await fetch(`${apiBase}/api/items/BL-077`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    // Wait briefly for async fire-and-forget emissions to arrive
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(received).toHaveLength(3);

    const actions = ['backlog.created', 'backlog.groomed', 'backlog.deleted'];
    const receivedActions = received.map((r) => (r.parsed.metadata as Record<string, unknown>).action);
    expect(receivedActions.sort()).toEqual(actions.sort());

    for (let i = 0; i < received.length; i += 1) {
      const entry = received[i];
      expect(Object.keys(entry.parsed).sort()).toEqual(REQUIRED_EVENT_KEYS);
      expect(entry.parsed.source).toBe('backlog');
      expect(entry.parsed.type).toBe('backlog.updated');
      expect(entry.parsed.divisionId).toBe('lounge');
      expect(entry.parsed.agentId).toBe(13);
      expect(entry.parsed.entityId).toBe('BL-077');
      expect(entry.parsed.targetZone).toBe('lounge');
      expect(entry.parsed.targetFloor).toBe(2);

      const expectedSig = `sha256=${createHmac('sha256', secret)
        .update(entry.rawBody)
        .digest('hex')}`;
      expect(entry.headers.authorization).toBe(`Bearer ${secret}`);
      expect(entry.headers['x-lokatalenta-signature']).toBe(expectedSig);
    }
  });

  it('omits auth headers when secret is unset and fails open when gateway errors or is offline', async () => {
    const errors: unknown[] = [];

    // 1. Offline port (listen then close immediately)
    const closedServer = http.createServer();
    await new Promise<void>((resolve) =>
      closedServer.listen(0, '127.0.0.1', () => resolve()),
    );
    const closedAddr = closedServer.address();
    if (!closedAddr || typeof closedAddr === 'string') throw new Error('Expected TCP address');
    const offlinePort = closedAddr.port;
    await new Promise<void>((resolve) => closedServer.close(() => resolve()));

    const db1 = openDatabase(':memory:');
    dbs.push(db1);
    const appOffline = createApp({
      db: db1,
      gatewayUrl: `http://127.0.0.1:${offlinePort}`,
      onEmitError: (err) => errors.push(err),
      staticDir: null,
    });
    const srv1 = http.createServer(appOffline);
    servers.push(srv1);
    await new Promise<void>((resolve) => srv1.listen(0, '127.0.0.1', () => resolve()));
    const addr1 = srv1.address();
    if (!addr1 || typeof addr1 === 'string') throw new Error('Expected TCP address');

    const resOffline = await fetch(`http://127.0.0.1:${addr1.port}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task',
        title: 'Resilient offline create',
        ownerDivision: 'qa',
        ownerAgentId: 7,
      }),
    });
    expect(resOffline.status).toBe(201);

    // 2. Gateway returning 500 without secret
    let seenHeaders: http.IncomingHttpHeaders | null = null;
    const errGateway = http.createServer((req, res) => {
      seenHeaders = req.headers;
      res.writeHead(500);
      res.end('fail');
    });
    servers.push(errGateway);
    await new Promise<void>((resolve) =>
      errGateway.listen(0, '127.0.0.1', () => resolve()),
    );
    const errAddr = errGateway.address();
    if (!errAddr || typeof errAddr === 'string') throw new Error('Expected TCP address');

    const db2 = openDatabase(':memory:');
    dbs.push(db2);
    const app500 = createApp({
      db: db2,
      gatewayUrl: `http://127.0.0.1:${errAddr.port}`,
      onEmitError: (err) => errors.push(err),
      staticDir: null,
    });
    const srv2 = http.createServer(app500);
    servers.push(srv2);
    await new Promise<void>((resolve) => srv2.listen(0, '127.0.0.1', () => resolve()));
    const addr2 = srv2.address();
    if (!addr2 || typeof addr2 === 'string') throw new Error('Expected TCP address');

    const res500 = await fetch(`http://127.0.0.1:${addr2.port}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task',
        title: 'Resilient 500 create',
        ownerDivision: 'engineering',
        ownerAgentId: 6,
      }),
    });
    expect(res500.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(seenHeaders).not.toBeNull();
    expect(seenHeaders!.authorization).toBeUndefined();
    expect(seenHeaders!['x-lokatalenta-signature']).toBeUndefined();
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
