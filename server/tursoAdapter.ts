import type { DatabaseSync } from 'node:sqlite';
import { createClient, type Client, type InStatement } from '@libsql/client';

export interface TursoConfig {
  readonly url: string;
  readonly authToken?: string;
}

export interface TursoHealthStatus {
  readonly configured: boolean;
  readonly healthy: boolean;
  readonly latencyMs: number | null;
  readonly error?: string;
}

export function loadTursoConfig(env: NodeJS.ProcessEnv = process.env): TursoConfig | null {
  const url = env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    return null;
  }
  const authToken = env.TURSO_AUTH_TOKEN?.trim() || undefined;
  return { url, authToken };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 150;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

export class TursoAdapter {
  private readonly config: TursoConfig | null;
  private readonly client: Client | null;

  constructor(config: TursoConfig | null = loadTursoConfig()) {
    this.config = config;
    this.client = config
      ? createClient({
          url: config.url,
          authToken: config.authToken,
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get url(): string | null {
    return this.config?.url ?? null;
  }

  async checkHealth(): Promise<TursoHealthStatus> {
    if (!this.client) {
      return { configured: false, healthy: false, latencyMs: null };
    }
    const start = Date.now();
    try {
      await withRetry(() => this.client!.execute('SELECT 1 AS ok'), {
        maxAttempts: 2,
        baseDelayMs: 50,
      });
      return {
        configured: true,
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Turso health check failed',
      };
    }
  }

  async ensureSchema(): Promise<void> {
    if (!this.client) return;
    const statements: InStatement[] = [
      `CREATE TABLE IF NOT EXISTS backlog_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        acceptance_criteria TEXT NOT NULL DEFAULT '[]',
        story_points INTEGER NOT NULL DEFAULT 1,
        priority TEXT NOT NULL,
        moscow TEXT NOT NULL,
        status TEXT NOT NULL,
        owner_division TEXT NOT NULL,
        owner_agent_id INTEGER NOT NULL,
        sprint_id TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS backlog_dependencies (
        item_id TEXT NOT NULL,
        depends_on_id TEXT NOT NULL,
        PRIMARY KEY (item_id, depends_on_id)
      )`,
    ];
    await withRetry(() => this.client!.batch(statements, 'write'));
  }

  async pullToLocal(db: DatabaseSync): Promise<number> {
    if (!this.client) return 0;
    await this.ensureSchema();

    const itemsRes = await withRetry(() =>
      this.client!.execute('SELECT * FROM backlog_items ORDER BY created_at ASC'),
    );
    if (itemsRes.rows.length === 0) return 0;

    const insertItem = db.prepare(`
      INSERT OR REPLACE INTO backlog_items (
        id, type, title, description, acceptance_criteria, story_points,
        priority, moscow, status, owner_division, owner_agent_id,
        sprint_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of itemsRes.rows) {
        const r = row as Record<string, string | number | null>;
        insertItem.run(
          String(r.id ?? ''),
          String(r.type ?? ''),
          String(r.title ?? ''),
          String(r.description ?? ''),
          String(r.acceptance_criteria ?? '[]'),
          Number(r.story_points ?? 1),
          String(r.priority ?? 'P1'),
          String(r.moscow ?? 'should'),
          String(r.status ?? 'raw'),
          String(r.owner_division ?? 'engineering'),
          Number(r.owner_agent_id ?? 0),
          r.sprint_id !== null && r.sprint_id !== undefined ? String(r.sprint_id) : null,
          String(r.created_at ?? new Date().toISOString()),
          String(r.updated_at ?? new Date().toISOString()),
        );
      }
      db.exec('COMMIT');
      return itemsRes.rows.length;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  async pushFromLocal(db: DatabaseSync): Promise<void> {
    if (!this.client) return;
    await this.ensureSchema();

    const localItems = db
      .prepare('SELECT * FROM backlog_items')
      .all() as unknown as Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      acceptance_criteria: string;
      story_points: number;
      priority: string;
      moscow: string;
      status: string;
      owner_division: string;
      owner_agent_id: number;
      sprint_id: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const statements: InStatement[] = localItems.map((item) => ({
      sql: `INSERT OR REPLACE INTO backlog_items (
        id, type, title, description, acceptance_criteria, story_points,
        priority, moscow, status, owner_division, owner_agent_id,
        sprint_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.id,
        item.type,
        item.title,
        item.description,
        item.acceptance_criteria,
        item.story_points,
        item.priority,
        item.moscow,
        item.status,
        item.owner_division,
        item.owner_agent_id,
        item.sprint_id,
        item.created_at,
        item.updated_at,
      ],
    }));

    if (statements.length > 0) {
      await withRetry(() => this.client!.batch(statements, 'write'));
    }
  }
}

export const tursoAdapter = new TursoAdapter();
