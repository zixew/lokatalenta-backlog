import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { openDatabase } from '../server/db.ts';
import type { BacklogItem, BacklogStats } from '../shared/types.ts';

async function startTestServer(db: DatabaseSync) {
  const app = createApp({
    db,
    gatewayUrl: 'disabled',
    staticDir: null,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP address');
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe('Backlog REST API & Dependency DAG', () => {
  const servers: http.Server[] = [];
  const dbs: DatabaseSync[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
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

  it('serves health, canonical 6 divisions, 24 agents, stats, and 400 on invalid JSON', async () => {
    const db = openDatabase(':memory:');
    dbs.push(db);
    const { server, baseUrl } = await startTestServer(db);
    servers.push(server);

    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as { ok: boolean; service: string };
    expect(healthJson.ok).toBe(true);
    expect(healthJson.service).toBe('lokatalenta-backlog');

    const divRes = await fetch(`${baseUrl}/api/divisions`);
    expect(divRes.status).toBe(200);
    const divJson = (await divRes.json()) as { divisions: Array<{ id: string }> };
    expect(divJson.divisions).toHaveLength(6);

    const agentsRes = await fetch(`${baseUrl}/api/agents`);
    expect(agentsRes.status).toBe(200);
    const agentsJson = (await agentsRes.json()) as { agents: Array<{ id: number }> };
    expect(agentsJson.agents).toHaveLength(24);

    const engAgentsRes = await fetch(`${baseUrl}/api/agents?division=engineering`);
    expect(engAgentsRes.status).toBe(200);
    const engAgentsJson = (await engAgentsRes.json()) as { agents: Array<{ id: number }> };
    expect(engAgentsJson.agents).toHaveLength(5);

    const badDivAgentsRes = await fetch(`${baseUrl}/api/agents?division=unknown`);
    expect(badDivAgentsRes.status).toBe(400);

    const badJsonRes = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title": ',
    });
    expect(badJsonRes.status).toBe(400);
    const badJson = (await badJsonRes.json()) as { error: string };
    expect(badJson.error).toBe('Invalid JSON body');

    const statsRes = await fetch(`${baseUrl}/api/stats`);
    expect(statsRes.status).toBe(200);
    const statsJson = (await statsRes.json()) as BacklogStats;
    expect(statsJson.total).toBe(0);
    expect(statsJson.byDivision.engineering).toBe(0);
    expect(statsJson.byStatus.raw).toBe(0);
  });

  it('enforces DAG cycle detection (self, 2-node, 3-hop) while allowing diamond DAGs and cascade delete', async () => {
    const db = openDatabase(':memory:');
    dbs.push(db);
    const { server, baseUrl } = await startTestServer(db);
    servers.push(server);

    // 1. Missing dependency -> 400
    const missingDepRes = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'BL-900',
        type: 'story',
        title: 'Missing dep',
        ownerDivision: 'engineering',
        ownerAgentId: 5,
        dependencies: ['BL-999'],
      }),
    });
    expect(missingDepRes.status).toBe(400);

    // 2. Self-dependency on POST -> 400
    const selfPostRes = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'BL-001',
        type: 'story',
        title: 'Self loop post',
        ownerDivision: 'engineering',
        ownerAgentId: 5,
        dependencies: ['BL-001'],
      }),
    });
    expect(selfPostRes.status).toBe(400);

    // Create D -> C -> B -> A chain setup: D standalone, B->[D], C->[D], A->[B,C] (Diamond DAG!)
    for (const payload of [
      { id: 'BL-004', type: 'task', title: 'Node D', ownerDivision: 'architecture', ownerAgentId: 4 },
      {
        id: 'BL-002',
        type: 'task',
        title: 'Node B',
        ownerDivision: 'engineering',
        ownerAgentId: 5,
        dependencies: ['BL-004'],
      },
      {
        id: 'BL-003',
        type: 'task',
        title: 'Node C',
        ownerDivision: 'qa',
        ownerAgentId: 8,
        dependencies: ['BL-004'],
      },
      {
        id: 'BL-001',
        type: 'epic',
        title: 'Diamond Root A',
        ownerDivision: 'executive',
        ownerAgentId: 0,
        dependencies: ['BL-002', 'BL-003'],
      },
    ]) {
      const res = await fetch(`${baseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(201);
    }

    // Self-dependency on PATCH -> 400
    const selfPatchRes = await fetch(`${baseUrl}/api/items/BL-004`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependencies: ['BL-004'] }),
    });
    expect(selfPatchRes.status).toBe(400);

    // 2-node cycle: BL-002 -> BL-001 when BL-001 -> BL-002 -> 400
    const twoNodeCycleRes = await fetch(`${baseUrl}/api/items/BL-002`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependencies: ['BL-001'] }),
    });
    expect(twoNodeCycleRes.status).toBe(400);
    const twoNodeJson = (await twoNodeCycleRes.json()) as { error: string; cycle?: string[] };
    expect(twoNodeJson.error).toContain('Circular dependency');
    expect(twoNodeJson.cycle).toBeDefined();

    // 3-hop cycle: BL-004 -> BL-001 (since BL-001 -> BL-002 -> BL-004) -> 400
    const threeHopCycleRes = await fetch(`${baseUrl}/api/items/BL-004`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependencies: ['BL-001'] }),
    });
    expect(threeHopCycleRes.status).toBe(400);
    const threeHopJson = (await threeHopCycleRes.json()) as { error: string; cycle?: string[] };
    expect(threeHopJson.error).toContain('Circular dependency');
    expect(threeHopJson.cycle?.length).toBeGreaterThanOrEqual(4);

    // Deleting referenced dependency BL-002 removes edge cleanly from BL-001
    const deleteRes = await fetch(`${baseUrl}/api/items/BL-002`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);
    const deleteJson = (await deleteRes.json()) as { ok: boolean; deletedId: string };
    expect(deleteJson).toEqual({ ok: true, deletedId: 'BL-002' });

    const getARes = await fetch(`${baseUrl}/api/items/BL-001`);
    expect(getARes.status).toBe(200);
    const getAJson = (await getARes.json()) as { item: BacklogItem };
    expect(getAJson.item.dependencies).toEqual(['BL-003']);
  });

  it('supports filters, Sprint Planner partial PATCH, stats, and file-backed SQLite persistence', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-api-'));
    tempDirs.push(tmpDir);
    const dbPath = path.join(tmpDir, 'test-backlog.db');

    const db = openDatabase(dbPath);
    dbs.push(db);
    const { server, baseUrl } = await startTestServer(db);
    servers.push(server);

    const post1 = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'ARC-010',
        type: 'story',
        title: 'Gateway Contract Registry',
        description: 'Define strict 13-key JSON schema',
        storyPoints: 5,
        priority: 'P0',
        moscow: 'must',
        status: 'ready',
        ownerDivision: 'architecture',
        ownerAgentId: 4,
      }),
    });
    expect(post1.status).toBe(201);

    const post2 = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'FIX-020',
        type: 'bug',
        title: 'Fix Safari scroll jitter',
        storyPoints: 3,
        priority: 'P1',
        moscow: 'should',
        status: 'done',
        ownerDivision: 'engineering',
        ownerAgentId: 5,
        sprintId: 'SPR-14',
      }),
    });
    expect(post2.status).toBe(201);

    // Partial PATCH from Sprint Planner
    const patchRes = await fetch(`${baseUrl}/api/items/ARC-010`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId: 'SPR-15', status: 'in_sprint' }),
    });
    expect(patchRes.status).toBe(200);
    const patchJson = (await patchRes.json()) as { item: BacklogItem };
    expect(patchJson.item.sprintId).toBe('SPR-15');
    expect(patchJson.item.status).toBe('in_sprint');
    expect(patchJson.item.title).toBe('Gateway Contract Registry');

    // Filters
    const filterRes = await fetch(
      `${baseUrl}/api/items?division=architecture&status=in_sprint&priority=P0&q=gateway`,
    );
    expect(filterRes.status).toBe(200);
    const filterJson = (await filterRes.json()) as { items: BacklogItem[] };
    expect(filterJson.items).toHaveLength(1);
    expect(filterJson.items[0].id).toBe('ARC-010');

    const statsRes = await fetch(`${baseUrl}/api/stats`);
    const statsJson = (await statsRes.json()) as BacklogStats;
    expect(statsJson.total).toBe(2);
    expect(statsJson.totalStoryPoints).toBe(8);
    expect(statsJson.completedStoryPoints).toBe(3);
    expect(statsJson.assignedToSprintCount).toBe(2);

    // 404 on missing item
    const missingGet = await fetch(`${baseUrl}/api/items/BL-404`);
    expect(missingGet.status).toBe(404);
    const missingPatch = await fetch(`${baseUrl}/api/items/BL-404`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    expect(missingPatch.status).toBe(404);
    const missingDelete = await fetch(`${baseUrl}/api/items/BL-404`, { method: 'DELETE' });
    expect(missingDelete.status).toBe(404);
  });
});
