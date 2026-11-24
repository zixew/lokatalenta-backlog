import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase, seedDatabaseIfEmpty } from '../server/db.ts';
import {
  createBacklogItem,
  DomainValidationError,
  sanitizeUserText,
} from '../server/domain.ts';

describe('Backlog Domain & Validation', () => {
  let db: DatabaseSync | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('auto-generates sequential BL-XXX IDs and accepts canonical prefixes', () => {
    db = openDatabase(':memory:');

    const first = createBacklogItem(db, {
      type: 'story',
      title: 'First item',
      ownerDivision: 'engineering',
      ownerAgentId: 5,
    });
    expect(first.id).toBe('BL-001');

    const second = createBacklogItem(db, {
      id: '   ',
      type: 'task',
      title: 'Second item',
      ownerDivision: 'qa',
      ownerAgentId: 8,
    });
    expect(second.id).toBe('BL-002');

    for (const prefix of ['FIX', 'REC', 'ARC', 'QAE', 'OFC', 'ECO']) {
      const item = createBacklogItem(db, {
        id: `${prefix}-101`,
        type: 'task',
        title: `Item ${prefix}`,
        ownerDivision: 'devops',
        ownerAgentId: 11,
      });
      expect(item.id).toBe(`${prefix}-101`);
    }
  });

  it('rejects invalid IDs with 400 and duplicate IDs with 409', () => {
    db = openDatabase(':memory:');

    expect(() =>
      createBacklogItem(db!, {
        id: 'FOO-1',
        type: 'story',
        title: 'Bad prefix',
        ownerDivision: 'executive',
        ownerAgentId: 0,
      }),
    ).toThrowError(DomainValidationError);

    try {
      createBacklogItem(db, {
        id: 'bad id',
        type: 'story',
        title: 'Bad chars',
        ownerDivision: 'executive',
        ownerAgentId: 0,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(DomainValidationError);
      expect((err as DomainValidationError).statusCode).toBe(400);
    }

    createBacklogItem(db, {
      id: 'BL-010',
      type: 'story',
      title: 'Original',
      ownerDivision: 'executive',
      ownerAgentId: 0,
    });

    try {
      createBacklogItem(db, {
        id: 'BL-010',
        type: 'story',
        title: 'Duplicate',
        ownerDivision: 'executive',
        ownerAgentId: 0,
      });
      expect.unreachable('Expected 409 conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainValidationError);
      expect((err as DomainValidationError).statusCode).toBe(409);
    }
  });

  it('validates enums, storyPoints, acceptanceCriteria XSS sanitization, divisions, and agents 0..23', () => {
    db = openDatabase(':memory:');

    const sanitized = sanitizeUserText(
      ' <script>alert(1)</script>javascript:doEvil() onclick=hack() Clean Title ',
    );
    expect(sanitized).toBe('alert(1)doEvil() hack() Clean Title');

    const created = createBacklogItem(db, {
      type: 'bug',
      title: '<b>XSS</b> Fix title',
      description: 'Details <img src=x onerror=alert(1)>',
      storyPoints: 0,
      priority: 'P0',
      moscow: 'must',
      status: 'groomed',
      ownerDivision: 'executive',
      ownerAgentId: 23, // cross-division valid 0..23 allowed
      acceptanceCriteria: [
        {
          given: 'a <i>user</i> submits form',
          when: 'payload has javascript:alert(1)',
          then: 'dangerous markup is stripped',
        },
      ],
    });

    expect(created.title).toBe('XSS Fix title');
    expect(created.storyPoints).toBe(0);
    expect(created.ownerAgentId).toBe(23);
    expect(created.acceptanceCriteria[0]).toEqual({
      given: 'a user submits form',
      when: 'payload has alert(1)',
      then: 'dangerous markup is stripped',
    });

    const invalidCases: Array<Record<string, unknown>> = [
      { type: 'invalid', title: 'T', ownerDivision: 'qa', ownerAgentId: 7 },
      { type: 'story', title: 'T', priority: 'P9', ownerDivision: 'qa', ownerAgentId: 7 },
      { type: 'story', title: 'T', moscow: 'maybe', ownerDivision: 'qa', ownerAgentId: 7 },
      { type: 'story', title: 'T', status: 'archived', ownerDivision: 'qa', ownerAgentId: 7 },
      { type: 'story', title: 'T', storyPoints: -1, ownerDivision: 'qa', ownerAgentId: 7 },
      { type: 'story', title: 'T', storyPoints: 1.5, ownerDivision: 'qa', ownerAgentId: 7 },
      { type: 'story', title: 'T', ownerDivision: 'marketing', ownerAgentId: 7 },
      { type: 'story', title: 'T', ownerDivision: 'qa', ownerAgentId: -1 },
      { type: 'story', title: 'T', ownerDivision: 'qa', ownerAgentId: 24 },
      { type: 'story', title: 'T', ownerDivision: 'qa', ownerAgentId: 1.5 },
      { type: 'story', title: 'T', ownerDivision: 'qa', ownerAgentId: '5' },
      { type: 'story', title: 'T', ownerDivision: 'qa', ownerAgentId: Number.NaN },
      {
        type: 'story',
        title: 'T',
        ownerDivision: 'qa',
        ownerAgentId: 7,
        acceptanceCriteria: [{ given: 'x', when: '', then: 'z' }],
      },
    ];

    for (const payload of invalidCases) {
      expect(() => createBacklogItem(db!, payload)).toThrowError(DomainValidationError);
    }
  });

  it('keeps :memory: DB empty on openDatabase and seeds idempotently only via seedDatabaseIfEmpty', () => {
    db = openDatabase(':memory:');
    const countBefore = db
      .prepare('SELECT COUNT(*) AS count FROM backlog_items')
      .get() as { count: number };
    expect(countBefore.count).toBe(0);

    const firstSeedCount = seedDatabaseIfEmpty(db);
    expect(firstSeedCount).toBe(10);

    const secondSeedCount = seedDatabaseIfEmpty(db);
    expect(secondSeedCount).toBe(0);
  });
});
