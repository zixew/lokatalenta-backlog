import http from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { openDatabase } from '../server/db.ts';
import { createBacklogItem, sanitizeCsvCell } from '../server/domain.ts';

describe('CSV Formula Injection Neutralization & Export Endpoint', () => {
  let db: DatabaseSync | null = null;
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    db?.close();
    db = null;
  });

  it('neutralizes formula triggers including leading whitespace, tabs, CRs, quotes, and newlines', () => {
    expect(sanitizeCsvCell('=CMD()')).toBe('"\'=CMD()"');
    expect(sanitizeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(sanitizeCsvCell('-1-1')).toBe('"\'-1-1"');
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe('"\'@SUM(A1:A2)"');
    expect(sanitizeCsvCell('\t=1')).toBe('"\'\t=1"');
    expect(sanitizeCsvCell('\r=1')).toBe('"\'\r=1"');
    expect(sanitizeCsvCell('\tfoo')).toBe('"\'\tfoo"');
    expect(sanitizeCsvCell('\rbar')).toBe('"\'\rbar"');
    expect(sanitizeCsvCell('  =1+1')).toBe('"\'  =1+1"');
    expect(sanitizeCsvCell(' \t+cmd')).toBe('"\' \t+cmd"');
    expect(sanitizeCsvCell('Say "hello", world')).toBe('"Say ""hello"", world"');
    expect(sanitizeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('serves GET /api/items/export.csv before :id route with sanitized CSV attachment', async () => {
    db = openDatabase(':memory:');
    createBacklogItem(db, {
      id: 'BL-001',
      type: 'bug',
      title: '=HYPERLINK("http://evil.example","Click")',
      description: '  +cmd|" /C calc"!A0',
      ownerDivision: 'devops',
      ownerAgentId: 17,
      acceptanceCriteria: [
        {
          given: '@user opens report',
          when: 'export runs',
          then: 'formula is neutralized',
        },
      ],
    });

    const app = createApp({ db, gatewayUrl: 'disabled', staticDir: null });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Expected TCP address');
    }

    const res = await fetch(`http://127.0.0.1:${addr.port}/api/items/export.csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="lokatalenta-backlog.csv"',
    );

    const csvText = await res.text();
    expect(csvText).toContain('"\'=HYPERLINK(""http://evil.example"",""Click"")"');
    expect(csvText).toContain('"\'+cmd|"" /C calc""!A0"');
    expect(csvText).toContain('BL-001');
  });
});
