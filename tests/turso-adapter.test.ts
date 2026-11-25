import { describe, expect, it } from 'vitest';
import { openDatabase } from '../server/db.ts';
import { loadTursoConfig, TursoAdapter, withRetry } from '../server/tursoAdapter.ts';

describe('TursoAdapter for Backlog Hub', () => {
  it('loads config from environment safely', () => {
    expect(loadTursoConfig({})).toBeNull();
    const config = loadTursoConfig({
      TURSO_DATABASE_URL: 'libsql://test.turso.io',
      TURSO_AUTH_TOKEN: 'secret_token',
    });
    expect(config).toEqual({
      url: 'libsql://test.turso.io',
      authToken: 'secret_token',
    });
  });

  it('reports unconfigured status when no env vars provided', async () => {
    const adapter = new TursoAdapter(null);
    expect(adapter.isConfigured).toBe(false);
    const health = await adapter.checkHealth();
    expect(health.configured).toBe(false);
    expect(health.healthy).toBe(false);
  });

  it('retries with exponential backoff on transient failures', async () => {
    let attempts = 0;
    const res = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('transient network glitch');
        }
        return 'success';
      },
      { maxAttempts: 3, baseDelayMs: 10 },
    );
    expect(res).toBe('success');
    expect(attempts).toBe(2);
  });

  it('safely handles pullToLocal and pushFromLocal when unconfigured', async () => {
    const adapter = new TursoAdapter(null);
    const db = openDatabase(':memory:');
    const pulled = await adapter.pullToLocal(db);
    expect(pulled).toBe(0);
    await expect(adapter.pushFromLocal(db)).resolves.toBeUndefined();
  });
});
