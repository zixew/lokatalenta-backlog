import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function resolveDbPath(explicitPath?: string): string {
  if (explicitPath !== undefined) {
    return explicitPath;
  }
  if (process.env.BACKLOG_DB_PATH) {
    return process.env.BACKLOG_DB_PATH;
  }
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  if (process.env.VERCEL === '1') {
    return '/tmp/lokatalenta-backlog.db';
  }
  return path.resolve(process.cwd(), 'data', 'backlog.db');
}

export function openDatabase(dbPath?: string): DatabaseSync {
  const resolvedPath = resolveDbPath(dbPath);
  if (resolvedPath !== ':memory:') {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath, {
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });

  db.exec('PRAGMA foreign_keys = ON;');
  if (resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS backlog_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('epic', 'story', 'task', 'bug', 'tech_debt')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      acceptance_criteria TEXT NOT NULL DEFAULT '[]',
      story_points INTEGER NOT NULL DEFAULT 1 CHECK (story_points >= 0 AND story_points <= 100),
      priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2')),
      moscow TEXT NOT NULL CHECK (moscow IN ('must', 'should', 'could', 'wont')),
      status TEXT NOT NULL CHECK (status IN ('raw', 'groomed', 'ready', 'in_sprint', 'done')),
      owner_division TEXT NOT NULL CHECK (owner_division IN ('executive', 'architecture', 'engineering', 'qa', 'devops', 'lounge')),
      owner_agent_id INTEGER NOT NULL CHECK (owner_agent_id >= 0 AND owner_agent_id <= 23),
      sprint_id TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backlog_dependencies (
      item_id TEXT NOT NULL,
      depends_on_id TEXT NOT NULL,
      PRIMARY KEY (item_id, depends_on_id),
      FOREIGN KEY (item_id) REFERENCES backlog_items(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_id) REFERENCES backlog_items(id) ON DELETE CASCADE,
      CHECK (item_id <> depends_on_id)
    );

    CREATE INDEX IF NOT EXISTS idx_backlog_items_status ON backlog_items(status);
    CREATE INDEX IF NOT EXISTS idx_backlog_items_division ON backlog_items(owner_division);
    CREATE INDEX IF NOT EXISTS idx_backlog_items_priority ON backlog_items(priority);
    CREATE INDEX IF NOT EXISTS idx_backlog_items_sprint ON backlog_items(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_backlog_deps_depends_on ON backlog_dependencies(depends_on_id);
  `);

  return db;
}

export function seedDatabaseIfEmpty(db: DatabaseSync): number {
  const countRow = db
    .prepare('SELECT COUNT(*) AS count FROM backlog_items')
    .get() as { count: number } | undefined;

  if ((countRow?.count ?? 0) > 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const starterItems = [
    {
      id: 'BL-001',
      type: 'epic',
      title: 'Decouple LokaTalenta 3D Office & Ecosystem Telemetry',
      description:
        'Establish canonical 6-division and 24-agent contracts across the standalone 3D Office and SDLC ecosystem apps.',
      acceptanceCriteria: [
        {
          given: 'the canonical division and agent contracts exist in Event Gateway',
          when: 'any ecosystem service emits a backlog or sprint update',
          then: 'the event validates cleanly against event-schema.json',
        },
      ],
      storyPoints: 8,
      priority: 'P0',
      moscow: 'must',
      status: 'ready',
      ownerDivision: 'executive',
      ownerAgentId: 2,
      sprintId: null,
    },
    {
      id: 'ARC-001',
      type: 'story',
      title: 'Hexagonal Event Gateway Contracts & HMAC Signing',
      description:
        'Define strict 13-key event payload schema and SHA-256 HMAC authentication contract for cross-repo telemetry.',
      acceptanceCriteria: [
        {
          given: 'GATEWAY_EVENT_SECRET is configured on an ecosystem emitter',
          when: 'POST /events is dispatched to Event Gateway',
          then: 'Authorization Bearer and x-lokatalenta-signature headers are included',
        },
      ],
      storyPoints: 5,
      priority: 'P0',
      moscow: 'must',
      status: 'groomed',
      ownerDivision: 'architecture',
      ownerAgentId: 4,
      sprintId: null,
    },
    {
      id: 'BL-002',
      type: 'story',
      title: 'Backlog Kanban, List View & Formula-Safe CSV Export',
      description:
        'Implement Anti-AI-Slop backlog UI with Given-When-Then acceptance criteria builder and CSV injection protection.',
      acceptanceCriteria: [
        {
          given: 'a backlog item contains formula-like characters in its title',
          when: 'a user exports /api/items/export.csv',
          then: 'dangerous leading characters are neutralized with a leading apostrophe',
        },
      ],
      storyPoints: 5,
      priority: 'P1',
      moscow: 'must',
      status: 'in_sprint',
      ownerDivision: 'engineering',
      ownerAgentId: 5,
      sprintId: 'SPR-01',
    },
    {
      id: 'QAE-001',
      type: 'task',
      title: 'Verify Dependency DAG Cycle Detection & Diamond Graphs',
      description:
        'Automated test suite validating 2-node cycles, multi-hop cycles, and valid diamond dependency graphs.',
      acceptanceCriteria: [
        {
          given: 'items A -> B -> C exist in the dependency graph',
          when: 'a request attempts to add A as a dependency of C',
          then: 'the API rejects the request with HTTP 400 and cycle trace',
        },
      ],
      storyPoints: 3,
      priority: 'P1',
      moscow: 'should',
      status: 'ready',
      ownerDivision: 'qa',
      ownerAgentId: 8,
      sprintId: null,
    },
    {
      id: 'OFC-001',
      type: 'task',
      title: 'Zero-Trust CSV Neutralization & JSON Input Hardening',
      description:
        'Ensure all user-supplied text fields strip HTML/script handlers and malformed JSON bodies return 400 JSON.',
      acceptanceCriteria: [
        {
          given: 'a client sends malformed JSON to POST /api/items',
          when: 'Express parses the request body',
          then: 'the server responds with HTTP 400 JSON instead of an HTML error page',
        },
      ],
      storyPoints: 3,
      priority: 'P0',
      moscow: 'must',
      status: 'groomed',
      ownerDivision: 'devops',
      ownerAgentId: 17,
      sprintId: null,
    },
    {
      id: 'REC-001',
      type: 'story',
      title: 'Stakeholder Rubric & Candidate Telemetry Privacy Guardrails',
      description:
        'Audit telemetry summaries emitted to 3D Office to ensure zero candidate PII is leaked in live ticker feeds.',
      acceptanceCriteria: [
        {
          given: 'a stakeholder reviews live ticker events in the 3D Office',
          when: 'backlog or LMS events appear in the stream',
          then: 'only anonymized entity IDs and division metrics are displayed',
        },
      ],
      storyPoints: 2,
      priority: 'P2',
      moscow: 'should',
      status: 'raw',
      ownerDivision: 'lounge',
      ownerAgentId: 23,
      sprintId: null,
    },
    {
      id: 'FREE-001',
      type: 'story',
      title: 'Enforce 100% Free-Access Policy & Zero Paywall Guardrails',
      description:
        'Ensure all assessment, Radar 5D, Kraepelin, and Recruiter Portal flows remain 100% free with zero Midtrans/Stripe/paywall gates.',
      acceptanceCriteria: [
        {
          given: 'any Student/Candidate, Teacher/Recruiter, or Admin user accesses the ecosystem',
          when: 'they navigate through assessments, reports, or organization onboarding',
          then: 'all features are accessible 100% free without any payment or paywall prompt',
        },
      ],
      storyPoints: 3,
      priority: 'P0',
      moscow: 'must',
      status: 'ready',
      ownerDivision: 'executive',
      ownerAgentId: 1,
      sprintId: 'SPR-16',
    },
    {
      id: 'DEBT-161',
      type: 'tech_debt',
      title: 'Audit Mermaid/ELK Chunk Budget & Serverless /tmp SQLite Persistence',
      description:
        'Mitigate lokatalenta-docs Mermaid/ELK bundle size via lazy loading and document durable persistence strategy beyond ephemeral Vercel /tmp SQLite.',
      acceptanceCriteria: [
        {
          given: 'lokatalenta-docs builds for production',
          when: 'initial client chunks are inspected',
          then: 'core route chunks remain lean and seeders stay idempotent across cold starts',
        },
      ],
      storyPoints: 5,
      priority: 'P1',
      moscow: 'must',
      status: 'ready',
      ownerDivision: 'architecture',
      ownerAgentId: 4,
      sprintId: 'SPR-16',
    },
    {
      id: 'QAE-161',
      type: 'story',
      title: 'Sprint 16 Complex Responsive Matrix (375px/768px/1280px+) & 3-POV E2E Suite',
      description:
        'Execute multi-step responsive, edge-case, and 3-User POV (Student/Candidate, Teacher/Recruiter, Admin/Governance) verification across all apps.',
      acceptanceCriteria: [
        {
          given: 'the ecosystem apps are rendered at 375px mobile, 768px tablet, and 1280px+ desktop',
          when: 'each 3-POV user executes end-to-end workflows including refresh and offline fallback',
          then: 'zero horizontal overflow, zero unhandled errors, and 100% test pass rate are achieved',
        },
      ],
      storyPoints: 8,
      priority: 'P0',
      moscow: 'must',
      status: 'ready',
      ownerDivision: 'qa',
      ownerAgentId: 8,
      sprintId: 'SPR-16',
    },
    {
      id: 'SEC-161',
      type: 'task',
      title: 'Multi-Step Race Condition, XSS/CSV Injection & State Recovery Verification',
      description:
        'Validate concurrent attempt/capacity updates, XSS/CSV formula neutralization, HMAC signing, and fail-open offline recovery.',
      acceptanceCriteria: [
        {
          given: 'adversarial payloads or concurrent mutations are dispatched',
          when: 'the API and UI process the requests',
          then: 'XSS/CSV injections are neutralized, race conditions are prevented, and state recovers cleanly',
        },
      ],
      storyPoints: 5,
      priority: 'P0',
      moscow: 'must',
      status: 'ready',
      ownerDivision: 'devops',
      ownerAgentId: 17,
      sprintId: 'SPR-16',
    },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO backlog_items (
      id, type, title, description, acceptance_criteria,
      story_points, priority, moscow, status,
      owner_division, owner_agent_id, sprint_id, created_at, updated_at
    ) VALUES (
      @id, @type, @title, @description, @acceptanceCriteria,
      @storyPoints, @priority, @moscow, @status,
      @ownerDivision, @ownerAgentId, @sprintId, @createdAt, @updatedAt
    )
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of starterItems) {
      insertStmt.run({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        acceptanceCriteria: JSON.stringify(item.acceptanceCriteria),
        storyPoints: item.storyPoints,
        priority: item.priority,
        moscow: item.moscow,
        status: item.status,
        ownerDivision: item.ownerDivision,
        ownerAgentId: item.ownerAgentId,
        sprintId: item.sprintId,
        createdAt: now,
        updatedAt: now,
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return starterItems.length;
}
