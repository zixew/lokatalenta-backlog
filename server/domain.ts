import type { DatabaseSync } from 'node:sqlite';
import {
  AGENT_MAP,
  BACKLOG_ID_REGEX,
  BACKLOG_ITEM_TYPES,
  BACKLOG_MOSCOWS,
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  DIVISION_IDS,
  DIVISION_MAP,
} from '../shared/contracts.ts';
import type {
  AcceptanceCriterion,
  BacklogItem,
  BacklogItemType,
  BacklogMoscow,
  BacklogPriority,
  BacklogStats,
  BacklogStatus,
  DivisionId,
} from '../shared/types.ts';

export class DomainValidationError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainValidationError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function sanitizeUserText(input: string, maxLength = 2000): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  const trimmedStart = str.replace(/^\s+/, '');
  const needsPrefix = /^[=+\-@\t\r]/.test(str) || /^[=+\-@\t\r]/.test(trimmedStart);
  const safe = needsPrefix ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function isValidBacklogId(id: string): boolean {
  return BACKLOG_ID_REGEX.test(id);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new DomainValidationError(
      400,
      `Invalid ${fieldName}: expected one of ${allowed.join(', ')}`,
    );
  }
  return value as T;
}

function parseAcceptanceCriteria(value: unknown): AcceptanceCriterion[] {
  if (!Array.isArray(value)) {
    throw new DomainValidationError(400, 'acceptanceCriteria must be an array');
  }

  return value.map((entry, idx) => {
    if (!isPlainObject(entry)) {
      throw new DomainValidationError(
        400,
        `acceptanceCriteria[${idx}] must be an object with given, when, then`,
      );
    }

    if (
      typeof entry.given !== 'string' ||
      typeof entry.when !== 'string' ||
      typeof entry.then !== 'string'
    ) {
      throw new DomainValidationError(
        400,
        `acceptanceCriteria[${idx}] must have string given, when, and then fields`,
      );
    }

    const given = sanitizeUserText(entry.given, 500);
    const when = sanitizeUserText(entry.when, 500);
    const then = sanitizeUserText(entry.then, 500);

    if (!given || !when || !then) {
      throw new DomainValidationError(
        400,
        `acceptanceCriteria[${idx}] given, when, and then must be non-empty`,
      );
    }

    return { given, when, then };
  });
}

function parseStoryPoints(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new DomainValidationError(400, 'storyPoints must be an integer between 0 and 100');
  }
  return value;
}

function parseOwnerDivision(value: unknown): DivisionId {
  return assertOneOf(value, DIVISION_IDS, 'ownerDivision');
}

function parseOwnerAgentId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !AGENT_MAP.has(value)) {
    throw new DomainValidationError(400, 'ownerAgentId must be an integer between 0 and 23');
  }
  return value;
}

function parseSprintId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new DomainValidationError(400, 'sprintId must be a string or null');
  }
  const sanitized = sanitizeUserText(value, 64);
  return sanitized.length === 0 ? null : sanitized;
}

function parseDependencies(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new DomainValidationError(400, 'dependencies must be an array of item IDs');
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawDep of value) {
    if (typeof rawDep !== 'string') {
      throw new DomainValidationError(400, 'Each dependency must be a string ID');
    }
    const trimmed = rawDep.trim();
    if (!trimmed) {
      throw new DomainValidationError(400, 'Dependency ID cannot be empty');
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function detectDependencyCycle(
  targetItemId: string,
  nextDependencies: readonly string[],
  existingDependenciesMap: Map<string, string[]>,
): string[] | null {
  if (nextDependencies.includes(targetItemId)) {
    return [targetItemId, targetItemId];
  }

  const graph = new Map<string, string[]>();
  for (const [node, deps] of existingDependenciesMap.entries()) {
    graph.set(node, [...deps]);
  }
  graph.set(targetItemId, [...nextDependencies]);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  const dfs = (node: string): string[] | null => {
    color.set(node, GRAY);
    stack.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      const state = color.get(neighbor) ?? WHITE;
      if (state === GRAY) {
        const cycleStartIdx = stack.indexOf(neighbor);
        return [...stack.slice(cycleStartIdx), neighbor];
      }
      if (state === WHITE) {
        const cycle = dfs(neighbor);
        if (cycle) {
          return cycle;
        }
      }
    }

    stack.pop();
    color.set(node, BLACK);
    return null;
  };

  for (const node of graph.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const cycle = dfs(node);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

function validateDependencyReferencesAndCycles(
  db: DatabaseSync,
  targetItemId: string,
  dependencies: readonly string[],
): void {
  if (dependencies.includes(targetItemId)) {
    throw new DomainValidationError(
      400,
      'Circular dependency detected: item cannot depend on itself',
      { cycle: [targetItemId, targetItemId] },
    );
  }

  if (dependencies.length > 0) {
    const placeholders = dependencies.map(() => '?').join(', ');
    const rows = db
      .prepare(`SELECT id FROM backlog_items WHERE id IN (${placeholders})`)
      .all(...dependencies) as Array<{ id: string }>;
    const found = new Set(rows.map((r) => r.id));
    const missing = dependencies.filter((dep) => !found.has(dep));
    if (missing.length > 0) {
      throw new DomainValidationError(
        400,
        `Unknown dependency item(s): ${missing.join(', ')}`,
      );
    }
  }

  const allEdgeRows = db
    .prepare('SELECT item_id, depends_on_id FROM backlog_dependencies')
    .all() as Array<{ item_id: string; depends_on_id: string }>;

  const adjacency = new Map<string, string[]>();
  for (const edge of allEdgeRows) {
    const list = adjacency.get(edge.item_id) ?? [];
    list.push(edge.depends_on_id);
    adjacency.set(edge.item_id, list);
  }

  const cycle = detectDependencyCycle(targetItemId, dependencies, adjacency);
  if (cycle) {
    throw new DomainValidationError(
      400,
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      { cycle },
    );
  }
}

interface BacklogRow {
  id: string;
  type: BacklogItemType;
  title: string;
  description: string;
  acceptance_criteria: string;
  story_points: number;
  priority: BacklogPriority;
  moscow: BacklogMoscow;
  status: BacklogStatus;
  owner_division: DivisionId;
  owner_agent_id: number;
  sprint_id: string | null;
  created_at: string;
  updated_at: string;
}

function loadDependenciesByItemIds(
  db: DatabaseSync,
  itemIds: readonly string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (itemIds.length === 0) {
    return result;
  }

  const placeholders = itemIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT item_id, depends_on_id FROM backlog_dependencies WHERE item_id IN (${placeholders}) ORDER BY depends_on_id ASC`,
    )
    .all(...itemIds) as Array<{ item_id: string; depends_on_id: string }>;

  for (const row of rows) {
    const existing = result.get(row.item_id) ?? [];
    existing.push(row.depends_on_id);
    result.set(row.item_id, existing);
  }

  return result;
}

function mapRowToBacklogItem(row: BacklogRow, dependencies: string[]): BacklogItem {
  let acceptanceCriteria: AcceptanceCriterion[] = [];
  try {
    const parsed = JSON.parse(row.acceptance_criteria) as unknown;
    if (Array.isArray(parsed)) {
      acceptanceCriteria = parsed as AcceptanceCriterion[];
    }
  } catch {
    acceptanceCriteria = [];
  }

  return {
    id: String(row.id),
    type: row.type,
    title: String(row.title),
    description: String(row.description),
    acceptanceCriteria,
    storyPoints: Number(row.story_points),
    priority: row.priority,
    moscow: row.moscow,
    status: row.status,
    ownerDivision: row.owner_division,
    ownerAgentId: Number(row.owner_agent_id),
    dependencies: [...dependencies],
    sprintId: row.sprint_id === null ? null : String(row.sprint_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function generateNextBacklogId(db: DatabaseSync): string {
  const rows = db
    .prepare("SELECT id FROM backlog_items WHERE id GLOB 'BL-[0-9]*'")
    .all() as Array<{ id: string }>;

  let maxNum = 0;
  for (const row of rows) {
    const match = /^BL-(\d+)$/.exec(row.id);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `BL-${String(maxNum + 1).padStart(3, '0')}`;
}

export interface ListItemsFilter {
  status?: string;
  division?: string;
  priority?: string;
  type?: string;
  sprintId?: string;
  q?: string;
}

export function listBacklogItems(db: DatabaseSync, filter: ListItemsFilter = {}): BacklogItem[] {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.status && filter.status !== 'all') {
    const status = assertOneOf(filter.status, BACKLOG_STATUSES, 'status');
    clauses.push('status = ?');
    params.push(status);
  }

  if (filter.division && filter.division !== 'all') {
    const division = assertOneOf(filter.division, DIVISION_IDS, 'division');
    clauses.push('owner_division = ?');
    params.push(division);
  }

  if (filter.priority && filter.priority !== 'all') {
    const priority = assertOneOf(filter.priority, BACKLOG_PRIORITIES, 'priority');
    clauses.push('priority = ?');
    params.push(priority);
  }

  if (filter.type && filter.type !== 'all') {
    const type = assertOneOf(filter.type, BACKLOG_ITEM_TYPES, 'type');
    clauses.push('type = ?');
    params.push(type);
  }

  if (filter.sprintId !== undefined && filter.sprintId !== '') {
    if (filter.sprintId === 'null' || filter.sprintId === 'unassigned') {
      clauses.push('sprint_id IS NULL');
    } else {
      clauses.push('sprint_id = ?');
      params.push(filter.sprintId.trim());
    }
  }

  if (filter.q && filter.q.trim() !== '') {
    const needle = `%${filter.q.trim().toLowerCase()}%`;
    clauses.push('(LOWER(id) LIKE ? OR LOWER(title) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(needle, needle, needle);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT id, type, title, description, acceptance_criteria, story_points, priority, moscow, status, owner_division, owner_agent_id, sprint_id, created_at, updated_at
       FROM backlog_items
       ${whereSql}
       ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END ASC, created_at DESC, id ASC`,
    )
    .all(...params) as unknown as BacklogRow[];

  const depsMap = loadDependenciesByItemIds(
    db,
    rows.map((r) => r.id),
  );

  return rows.map((row) => mapRowToBacklogItem(row, depsMap.get(row.id) ?? []));
}

export function getBacklogItemById(db: DatabaseSync, id: string): BacklogItem | null {
  const row = db
    .prepare(
      `SELECT id, type, title, description, acceptance_criteria, story_points, priority, moscow, status, owner_division, owner_agent_id, sprint_id, created_at, updated_at
       FROM backlog_items
       WHERE id = ?`,
    )
    .get(id) as BacklogRow | undefined;

  if (!row) {
    return null;
  }

  const depsMap = loadDependenciesByItemIds(db, [row.id]);
  return mapRowToBacklogItem(row, depsMap.get(row.id) ?? []);
}

export function createBacklogItem(db: DatabaseSync, rawInput: unknown): BacklogItem {
  if (!isPlainObject(rawInput)) {
    throw new DomainValidationError(400, 'Request body must be a JSON object');
  }

  const type = assertOneOf(rawInput.type, BACKLOG_ITEM_TYPES, 'type');

  if (typeof rawInput.title !== 'string') {
    throw new DomainValidationError(400, 'title is required');
  }
  const title = sanitizeUserText(rawInput.title, 200);
  if (!title) {
    throw new DomainValidationError(400, 'title must be non-empty');
  }

  let description = '';
  if (rawInput.description !== undefined) {
    if (typeof rawInput.description !== 'string') {
      throw new DomainValidationError(400, 'description must be a string');
    }
    description = sanitizeUserText(rawInput.description, 4000);
  }

  const acceptanceCriteria =
    rawInput.acceptanceCriteria === undefined
      ? []
      : parseAcceptanceCriteria(rawInput.acceptanceCriteria);

  const storyPoints =
    rawInput.storyPoints === undefined ? 1 : parseStoryPoints(rawInput.storyPoints);

  const priority =
    rawInput.priority === undefined
      ? 'P1'
      : assertOneOf(rawInput.priority, BACKLOG_PRIORITIES, 'priority');

  const moscow =
    rawInput.moscow === undefined
      ? 'should'
      : assertOneOf(rawInput.moscow, BACKLOG_MOSCOWS, 'moscow');

  const status =
    rawInput.status === undefined
      ? 'raw'
      : assertOneOf(rawInput.status, BACKLOG_STATUSES, 'status');

  const ownerDivision = parseOwnerDivision(rawInput.ownerDivision);
  const ownerAgentId = parseOwnerAgentId(rawInput.ownerAgentId);
  const sprintId = parseSprintId(rawInput.sprintId);
  const dependencies =
    rawInput.dependencies === undefined ? [] : parseDependencies(rawInput.dependencies);

  let requestedId: string | null = null;
  if (rawInput.id !== undefined && rawInput.id !== null) {
    if (typeof rawInput.id !== 'string') {
      throw new DomainValidationError(400, 'id must be a string');
    }
    const trimmedId = rawInput.id.trim();
    if (trimmedId.length > 0) {
      if (!isValidBacklogId(trimmedId)) {
        throw new DomainValidationError(
          400,
          'Invalid id format: must match (BL|FIX|REC|ARC|QAE|OFC|ECO)-[A-Z0-9][A-Z0-9-]{0,30}',
        );
      }
      requestedId = trimmedId;
    }
  }

  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    const finalId = requestedId ?? generateNextBacklogId(db);

    const existing = db
      .prepare('SELECT id FROM backlog_items WHERE id = ?')
      .get(finalId) as { id: string } | undefined;
    if (existing) {
      throw new DomainValidationError(409, `Backlog item already exists: ${finalId}`);
    }

    validateDependencyReferencesAndCycles(db, finalId, dependencies);

    db.prepare(
      `INSERT INTO backlog_items (
        id, type, title, description, acceptance_criteria,
        story_points, priority, moscow, status,
        owner_division, owner_agent_id, sprint_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      finalId,
      type,
      title,
      description,
      JSON.stringify(acceptanceCriteria),
      storyPoints,
      priority,
      moscow,
      status,
      ownerDivision,
      ownerAgentId,
      sprintId,
      now,
      now,
    );

    const depInsert = db.prepare(
      'INSERT INTO backlog_dependencies (item_id, depends_on_id) VALUES (?, ?)',
    );
    for (const depId of dependencies) {
      depInsert.run(finalId, depId);
    }

    db.exec('COMMIT');
    const created = getBacklogItemById(db, finalId);
    if (!created) {
      throw new Error('Failed to retrieve created backlog item');
    }
    return created;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export interface UpdateResult {
  previous: BacklogItem;
  updated: BacklogItem;
}

export function updateBacklogItem(
  db: DatabaseSync,
  id: string,
  rawInput: unknown,
): UpdateResult | null {
  if (!isPlainObject(rawInput)) {
    throw new DomainValidationError(400, 'Request body must be a JSON object');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = getBacklogItemById(db, id);
    if (!existing) {
      db.exec('ROLLBACK');
      return null;
    }

    const nextType =
      rawInput.type === undefined
        ? existing.type
        : assertOneOf(rawInput.type, BACKLOG_ITEM_TYPES, 'type');

    let nextTitle = existing.title;
    if (rawInput.title !== undefined) {
      if (typeof rawInput.title !== 'string') {
        throw new DomainValidationError(400, 'title must be a string');
      }
      nextTitle = sanitizeUserText(rawInput.title, 200);
      if (!nextTitle) {
        throw new DomainValidationError(400, 'title must be non-empty');
      }
    }

    let nextDescription = existing.description;
    if (rawInput.description !== undefined) {
      if (typeof rawInput.description !== 'string') {
        throw new DomainValidationError(400, 'description must be a string');
      }
      nextDescription = sanitizeUserText(rawInput.description, 4000);
    }

    const nextAcceptanceCriteria =
      rawInput.acceptanceCriteria === undefined
        ? existing.acceptanceCriteria
        : parseAcceptanceCriteria(rawInput.acceptanceCriteria);

    const nextStoryPoints =
      rawInput.storyPoints === undefined
        ? existing.storyPoints
        : parseStoryPoints(rawInput.storyPoints);

    const nextPriority =
      rawInput.priority === undefined
        ? existing.priority
        : assertOneOf(rawInput.priority, BACKLOG_PRIORITIES, 'priority');

    const nextMoscow =
      rawInput.moscow === undefined
        ? existing.moscow
        : assertOneOf(rawInput.moscow, BACKLOG_MOSCOWS, 'moscow');

    const nextStatus =
      rawInput.status === undefined
        ? existing.status
        : assertOneOf(rawInput.status, BACKLOG_STATUSES, 'status');

    const nextOwnerDivision =
      rawInput.ownerDivision === undefined
        ? existing.ownerDivision
        : parseOwnerDivision(rawInput.ownerDivision);

    const nextOwnerAgentId =
      rawInput.ownerAgentId === undefined
        ? existing.ownerAgentId
        : parseOwnerAgentId(rawInput.ownerAgentId);

    const nextSprintId =
      rawInput.sprintId === undefined ? existing.sprintId : parseSprintId(rawInput.sprintId);

    const nextDependencies =
      rawInput.dependencies === undefined
        ? existing.dependencies
        : parseDependencies(rawInput.dependencies);

    if (rawInput.dependencies !== undefined) {
      validateDependencyReferencesAndCycles(db, id, nextDependencies);
    }

    const updatedAt = new Date().toISOString();

    db.prepare(
      `UPDATE backlog_items SET
        type = ?,
        title = ?,
        description = ?,
        acceptance_criteria = ?,
        story_points = ?,
        priority = ?,
        moscow = ?,
        status = ?,
        owner_division = ?,
        owner_agent_id = ?,
        sprint_id = ?,
        updated_at = ?
      WHERE id = ?`,
    ).run(
      nextType,
      nextTitle,
      nextDescription,
      JSON.stringify(nextAcceptanceCriteria),
      nextStoryPoints,
      nextPriority,
      nextMoscow,
      nextStatus,
      nextOwnerDivision,
      nextOwnerAgentId,
      nextSprintId,
      updatedAt,
      id,
    );

    if (rawInput.dependencies !== undefined) {
      db.prepare('DELETE FROM backlog_dependencies WHERE item_id = ?').run(id);
      const depInsert = db.prepare(
        'INSERT INTO backlog_dependencies (item_id, depends_on_id) VALUES (?, ?)',
      );
      for (const depId of nextDependencies) {
        depInsert.run(id, depId);
      }
    }

    db.exec('COMMIT');
    const updated = getBacklogItemById(db, id);
    if (!updated) {
      throw new Error('Failed to retrieve updated backlog item');
    }
    return { previous: existing, updated };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function deleteBacklogItem(db: DatabaseSync, id: string): BacklogItem | null {
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = getBacklogItemById(db, id);
    if (!existing) {
      db.exec('ROLLBACK');
      return null;
    }

    db.prepare('DELETE FROM backlog_items WHERE id = ?').run(id);
    db.exec('COMMIT');
    return existing;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getBacklogStats(db: DatabaseSync): BacklogStats {
  const byStatus: Record<BacklogStatus, number> = {
    raw: 0,
    groomed: 0,
    ready: 0,
    in_sprint: 0,
    done: 0,
  };
  const byDivision: Record<DivisionId, number> = {
    executive: 0,
    architecture: 0,
    engineering: 0,
    qa: 0,
    devops: 0,
    lounge: 0,
  };
  const byPriority: Record<BacklogPriority, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
  };
  const byType: Record<BacklogItemType, number> = {
    epic: 0,
    story: 0,
    task: 0,
    bug: 0,
    tech_debt: 0,
  };

  const rows = db
    .prepare(
      'SELECT type, story_points, priority, status, owner_division, sprint_id FROM backlog_items',
    )
    .all() as Array<{
    type: BacklogItemType;
    story_points: number;
    priority: BacklogPriority;
    status: BacklogStatus;
    owner_division: DivisionId;
    sprint_id: string | null;
  }>;

  let totalStoryPoints = 0;
  let completedStoryPoints = 0;
  let groomedCount = 0;
  let assignedToSprintCount = 0;

  for (const row of rows) {
    byStatus[row.status] += 1;
    byDivision[row.owner_division] += 1;
    byPriority[row.priority] += 1;
    byType[row.type] += 1;
    totalStoryPoints += Number(row.story_points);
    if (row.status === 'done') {
      completedStoryPoints += Number(row.story_points);
    }
    if (row.status !== 'raw') {
      groomedCount += 1;
    }
    if (row.sprint_id !== null || row.status === 'in_sprint') {
      assignedToSprintCount += 1;
    }
  }

  return {
    total: rows.length,
    byStatus,
    byDivision,
    byPriority,
    byType,
    totalStoryPoints,
    completedStoryPoints,
    groomedCount,
    assignedToSprintCount,
  };
}

export function exportBacklogCsv(items: readonly BacklogItem[]): string {
  const headers = [
    'ID',
    'Type',
    'Title',
    'Description',
    'Status',
    'Priority',
    'MoSCoW',
    'Story Points',
    'Owner Division',
    'Owner Division Name',
    'Owner Agent ID',
    'Owner Agent Name',
    'Sprint ID',
    'Dependencies',
    'Acceptance Criteria',
    'Created At',
    'Updated At',
  ];

  const lines = [headers.map((h) => sanitizeCsvCell(h)).join(',')];

  for (const item of items) {
    const division = DIVISION_MAP.get(item.ownerDivision);
    const agent = AGENT_MAP.get(item.ownerAgentId);
    const acSummary = item.acceptanceCriteria
      .map((ac) => `Given ${ac.given} | When ${ac.when} | Then ${ac.then}`)
      .join(' ; ');

    const row = [
      item.id,
      item.type,
      item.title,
      item.description,
      item.status,
      item.priority,
      item.moscow,
      String(item.storyPoints),
      item.ownerDivision,
      division?.name ?? item.ownerDivision,
      String(item.ownerAgentId),
      agent?.name ?? `Agent #${item.ownerAgentId}`,
      item.sprintId ?? '',
      item.dependencies.join('; '),
      acSummary,
      item.createdAt,
      item.updatedAt,
    ];

    lines.push(row.map((cell) => sanitizeCsvCell(cell)).join(','));
  }

  return lines.join('\r\n');
}
