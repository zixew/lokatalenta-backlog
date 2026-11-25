import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import {
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  DIVISION_IDS,
  ECOSYSTEM_PORTS,
  getAgentsByDivision,
} from '../shared/contracts.ts';
import type { BacklogItem, DivisionId } from '../shared/types.ts';
import {
  createBacklogItem,
  deleteBacklogItem,
  DomainValidationError,
  exportBacklogCsv,
  getBacklogItemById,
  getBacklogStats,
  listBacklogItems,
  updateBacklogItem,
} from './domain.ts';
import { createGatewayEmitter, type GatewayEmitter } from './gatewayEmitter.ts';
import { tursoAdapter } from './tursoAdapter.ts';

export interface CreateAppOptions {
  db: DatabaseSync;
  port?: number;
  gatewayUrl?: string;
  gatewaySecret?: string;
  gatewayEmitter?: GatewayEmitter;
  staticDir?: string | null;
  corsOrigins?: string;
  onEmitError?: (error: unknown) => void;
}

function matchOriginPattern(url: URL, rawPattern: string): boolean {
  const pattern = rawPattern.trim();
  if (!pattern) {
    return false;
  }
  if (pattern === '*') {
    return true;
  }
  const normalizedOrigin = `${url.protocol}//${url.host}`;
  if (pattern === normalizedOrigin || pattern === url.origin) {
    return true;
  }

  let requiredProtocol: string | null = null;
  let hostPattern = pattern;
  if (hostPattern.startsWith('http://')) {
    requiredProtocol = 'http:';
    hostPattern = hostPattern.slice('http://'.length);
  } else if (hostPattern.startsWith('https://')) {
    requiredProtocol = 'https:';
    hostPattern = hostPattern.slice('https://'.length);
  }

  if (requiredProtocol && url.protocol !== requiredProtocol) {
    return false;
  }

  if (hostPattern.endsWith(':*')) {
    const targetHost = hostPattern.slice(0, -2);
    return url.hostname === targetHost;
  }

  if (hostPattern.startsWith('*.')) {
    const suffix = hostPattern.slice(1); // includes leading dot, e.g. '.vercel.app'
    return url.hostname.endsWith(suffix) && url.hostname.length > suffix.length;
  }

  return url.host === hostPattern;
}

export function isOriginAllowed(
  origin: string | undefined,
  corsOriginsEnv: string | undefined = process.env.CORS_ORIGINS,
): boolean {
  if (!origin) {
    return true;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  // Default ecosystem-safe patterns: localhost:*, 127.0.0.1:*, *.vercel.app
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    (url.hostname.endsWith('.vercel.app') && url.hostname.length > '.vercel.app'.length)
  ) {
    return true;
  }

  if (corsOriginsEnv) {
    const patterns = corsOriginsEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pattern of patterns) {
      if (matchOriginPattern(url, pattern)) {
        return true;
      }
    }
  }

  return false;
}

function getQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export function createApp(options: CreateAppOptions): Express {
  const { db } = options;
  const port = options.port ?? ECOSYSTEM_PORTS.backlog.apiPort;
  const emitter =
    options.gatewayEmitter ??
    createGatewayEmitter({
      gatewayUrl: options.gatewayUrl,
      secret: options.gatewaySecret,
      onEmitError: options.onEmitError,
    });

  const app = express();
  const corsOrigins = options.corsOrigins;
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isOriginAllowed(origin, corsOrigins));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Malformed JSON body guard
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    next(err);
  });

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    const tursoHealth = await tursoAdapter.checkHealth();
    res.json({
      ok: true,
      service: 'lokatalenta-backlog',
      port,
      turso: tursoHealth,
      timestamp: new Date().toISOString(),
    });
  });

  api.get('/divisions', (_req, res) => {
    res.json({ divisions: CANONICAL_DIVISIONS });
  });

  api.get('/agents', (req, res, next) => {
    try {
      const division = getQueryString(req.query.division);
      if (division && division !== 'all') {
        if (!DIVISION_IDS.includes(division as DivisionId)) {
          throw new DomainValidationError(
            400,
            `Invalid division: expected one of ${DIVISION_IDS.join(', ')}`,
          );
        }
        res.json({ agents: getAgentsByDivision(division as DivisionId) });
        return;
      }
      res.json({ agents: CANONICAL_AGENTS });
    } catch (err) {
      next(err);
    }
  });

  api.get('/stats', (_req, res) => {
    res.json(getBacklogStats(db));
  });

  // MUST precede /items/:id in Express 5
  api.get('/items/export.csv', (req, res, next) => {
    try {
      const items = listBacklogItems(db, {
        status: getQueryString(req.query.status),
        division: getQueryString(req.query.division),
        priority: getQueryString(req.query.priority),
        type: getQueryString(req.query.type),
        sprintId: getQueryString(req.query.sprintId),
        q: getQueryString(req.query.q),
      });
      const csv = exportBacklogCsv(items);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="lokatalenta-backlog.csv"');
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  });

  api.get('/items', (req, res, next) => {
    try {
      const items = listBacklogItems(db, {
        status: getQueryString(req.query.status),
        division: getQueryString(req.query.division),
        priority: getQueryString(req.query.priority),
        type: getQueryString(req.query.type),
        sprintId: getQueryString(req.query.sprintId),
        q: getQueryString(req.query.q),
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  api.get('/items/:id', (req, res, next) => {
    try {
      const item = getBacklogItemById(db, req.params.id);
      if (!item) {
        res.status(404).json({ error: `Backlog item not found: ${req.params.id}` });
        return;
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  api.post('/evaluations/score', async (req, res, next) => {
    try {
      const body = req.body as {
        candidateId?: string;
        role?: string;
        scores?: { technical?: number; culture?: number; problemSolving?: number };
        weights?: { technical?: number; culture?: number; problemSolving?: number };
      };

      const candidateId = typeof body.candidateId === 'string' && body.candidateId.trim()
        ? body.candidateId.trim()
        : `cand-${Date.now().toString(36)}`;
      const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'Software Engineer';
      
      const techScore = Math.max(0, Math.min(100, Number(body.scores?.technical ?? 80)));
      const cultScore = Math.max(0, Math.min(100, Number(body.scores?.culture ?? 85)));
      const probScore = Math.max(0, Math.min(100, Number(body.scores?.problemSolving ?? 90)));

      const wTech = Number(body.weights?.technical ?? 0.5);
      const wCult = Number(body.weights?.culture ?? 0.25);
      const wProb = Number(body.weights?.problemSolving ?? 0.25);
      const sumWeights = wTech + wCult + wProb || 1;

      const compositeScore = Math.round(((techScore * wTech) + (cultScore * wCult) + (probScore * wProb)) / sumWeights);
      const evaluation = {
        candidateId,
        role,
        scores: { technical: techScore, culture: cultScore, problemSolving: probScore },
        weights: { technical: wTech, culture: wCult, problemSolving: wProb },
        compositeScore,
        matched: compositeScore >= 75,
        evaluatedAt: new Date().toISOString(),
      };

      const dummyItem: BacklogItem = {
        id: candidateId,
        type: 'task',
        title: `AI Evaluation: ${candidateId} (${compositeScore}/100)`,
        description: `Candidate evaluation for ${role}`,
        acceptanceCriteria: [],
        dependencies: [],
        storyPoints: 1,
        priority: 'P1',
        moscow: 'should',
        status: evaluation.matched ? 'done' : 'ready',
        ownerDivision: 'engineering',
        ownerAgentId: 4,
        sprintId: 'SPR-19',
        createdAt: evaluation.evaluatedAt,
        updatedAt: evaluation.evaluatedAt,
      };
      void emitter.emitBacklogEvent('backlog.updated', dummyItem, { compositeScore, matched: evaluation.matched });

      res.status(200).json({ evaluation });
    } catch (err) {
      next(err);
    }
  });

  api.post('/candidates/batch', (req, res, next) => {
    try {
      const body = req.body as { candidates?: Array<{ id?: string; name?: string; role?: string; score?: number }> };
      if (!Array.isArray(body.candidates)) {
        throw new DomainValidationError(400, 'candidates must be an array');
      }

      const total = body.candidates.length;
      if (total > 100) {
        throw new DomainValidationError(400, 'batch size exceeds maximum of 100 candidates');
      }

      const ingested = body.candidates.map((c, idx) => ({
        id: c.id || `cand-batch-${idx + 1}`,
        name: c.name || `Candidate ${idx + 1}`,
        role: c.role || 'Generalist',
        score: typeof c.score === 'number' ? Math.max(0, Math.min(100, c.score)) : 75,
        status: 'ingested',
        ingestedAt: new Date().toISOString(),
      }));

      res.status(201).json({
        total,
        ingestedCount: ingested.length,
        candidates: ingested,
      });
    } catch (err) {
      next(err);
    }
  });

  api.post('/items', (req, res, next) => {
    try {
      const item = createBacklogItem(db, req.body);
      void emitter.emitBacklogEvent('backlog.created', item);
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  api.patch('/items/:id', (req, res, next) => {
    try {
      const result = updateBacklogItem(db, req.params.id, req.body);
      if (!result) {
        res.status(404).json({ error: `Backlog item not found: ${req.params.id}` });
        return;
      }

      const { previous, updated } = result;
      const action =
        previous.status !== updated.status &&
        (updated.status === 'groomed' || updated.status === 'ready')
          ? 'backlog.groomed'
          : 'backlog.updated';

      void emitter.emitBacklogEvent(action, updated, {
        previousStatus: previous.status,
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  api.delete('/items/:id', (req, res, next) => {
    try {
      const deleted = deleteBacklogItem(db, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: `Backlog item not found: ${req.params.id}` });
        return;
      }

      void emitter.emitBacklogEvent('backlog.deleted', deleted);
      res.json({ ok: true, deletedId: deleted.id });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', api);

  // API 404 handler (never falls through to SPA HTML)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // API error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DomainValidationError) {
      res.status(err.statusCode).json({
        error: err.message,
        ...(err.details ?? {}),
      });
      return;
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  // Static serving & SPA fallback (Express 5 safe middleware — never app.get('*'))
  if (options.staticDir) {
    const resolvedStaticDir = path.resolve(options.staticDir);
    const indexHtmlPath = path.join(resolvedStaticDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      app.use(express.static(resolvedStaticDir));
      app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }
        if (req.path.startsWith('/api')) {
          next();
          return;
        }
        res.sendFile(indexHtmlPath);
      });
    }
  }

  return app;
}
