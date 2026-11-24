import type {
  BacklogItem,
  BacklogStats,
  CreateBacklogItemInput,
  UpdateBacklogItemInput,
} from '../../../shared/types.ts';

export interface BacklogFilterParams {
  status?: string;
  division?: string;
  priority?: string;
  type?: string;
  sprintId?: string;
  q?: string;
}

export class ApiError extends Error {
  status: number;
  cycle?: string[];

  constructor(status: number, message: string, cycle?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cycle = cycle;
  }
}

function buildFilterQuery(filters: BacklogFilterParams = {}): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.division && filters.division !== 'all') params.set('division', filters.division);
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.sprintId) params.set('sprintId', filters.sprintId);
  if (filters.q && filters.q.trim() !== '') params.set('q', filters.q.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : `Request failed with HTTP ${res.status}`;
    const cycle = Array.isArray(data.cycle)
      ? data.cycle.filter((entry): entry is string => typeof entry === 'string')
      : undefined;
    throw new ApiError(res.status, message, cycle);
  }
  return data as T;
}

export async function fetchBacklogItems(
  filters: BacklogFilterParams = {},
): Promise<BacklogItem[]> {
  const res = await fetch(`/api/items${buildFilterQuery(filters)}`);
  const data = await parseResponse<{ items: BacklogItem[] }>(res);
  return data.items;
}

export async function fetchBacklogStats(): Promise<BacklogStats> {
  const res = await fetch('/api/stats');
  return parseResponse<BacklogStats>(res);
}

export async function createBacklogItemApi(
  input: CreateBacklogItemInput,
): Promise<BacklogItem> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ item: BacklogItem }>(res);
  return data.item;
}

export async function updateBacklogItemApi(
  id: string,
  input: UpdateBacklogItemInput,
): Promise<BacklogItem> {
  const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ item: BacklogItem }>(res);
  return data.item;
}

export async function deleteBacklogItemApi(id: string): Promise<string> {
  const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await parseResponse<{ ok: boolean; deletedId: string }>(res);
  return data.deletedId;
}

export function getExportCsvUrl(filters: BacklogFilterParams = {}): string {
  return `/api/items/export.csv${buildFilterQuery(filters)}`;
}
