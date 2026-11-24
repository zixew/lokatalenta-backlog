import { createHmac, randomUUID } from 'node:crypto';
import { DIVISION_MAP, ECOSYSTEM_PORTS } from '../shared/contracts.ts';
import type {
  BacklogEventAction,
  BacklogItem,
  NormalizedBacklogEvent,
} from '../shared/types.ts';

export interface GatewayEmitterOptions {
  gatewayUrl?: string;
  secret?: string;
  timeoutMs?: number;
  onEmitError?: (error: unknown) => void;
}

export interface GatewayEmitter {
  emitBacklogEvent: (
    action: BacklogEventAction,
    item: BacklogItem,
    extraMetadata?: Record<string, unknown>,
  ) => Promise<void>;
}

export function buildBacklogEventPayload(
  action: BacklogEventAction,
  item: BacklogItem,
  extraMetadata?: Record<string, unknown>,
): NormalizedBacklogEvent {
  const division = DIVISION_MAP.get(item.ownerDivision);
  const targetZone = division?.defaultZone ?? 'workspace';
  const targetFloor = division?.defaultFloor ?? 2;

  const severity =
    action === 'backlog.deleted'
      ? 'warning'
      : item.status === 'done' || action === 'backlog.groomed'
        ? 'success'
        : 'info';

  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'backlog',
    type: 'backlog.updated',
    divisionId: item.ownerDivision,
    agentId: item.ownerAgentId,
    entityId: item.id,
    title: `[${item.id}] ${item.title}`.slice(0, 160),
    summary: `${action} • ${item.status} • ${item.priority} (${item.storyPoints} SP)`.slice(
      0,
      500,
    ),
    targetZone,
    targetFloor,
    severity,
    metadata: {
      action,
      itemType: item.type,
      status: item.status,
      priority: item.priority,
      moscow: item.moscow,
      storyPoints: item.storyPoints,
      sprintId: item.sprintId,
      ...(extraMetadata ?? {}),
    },
  };
}

export function createGatewayEmitter(options: GatewayEmitterOptions = {}): GatewayEmitter {
  const rawUrl =
    options.gatewayUrl !== undefined
      ? options.gatewayUrl
      : (process.env.EVENT_GATEWAY_URL ?? ECOSYSTEM_PORTS.eventGateway.baseUrl);
  const trimmedUrl = rawUrl.trim().replace(/\/+$/, '');
  const disabled = trimmedUrl === '' || trimmedUrl.toLowerCase() === 'disabled';

  const secret =
    options.secret !== undefined
      ? options.secret
      : (process.env.GATEWAY_EVENT_SECRET ?? '');
  const timeoutMs = options.timeoutMs ?? 1500;

  return {
    async emitBacklogEvent(action, item, extraMetadata) {
      if (disabled) {
        return;
      }

      const payload = buildBacklogEventPayload(action, item, extraMetadata);
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (secret.length > 0) {
        const signature = createHmac('sha256', secret).update(body).digest('hex');
        headers.Authorization = `Bearer ${secret}`;
        headers['x-lokatalenta-signature'] = `sha256=${signature}`;
      }

      try {
        const response = await fetch(`${trimmedUrl}/events`, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const message = `Gateway returned HTTP ${response.status}`;
          if (options.onEmitError) {
            options.onEmitError(new Error(message));
          } else {
            console.warn(`[backlog-gateway-emitter] ${message}`);
          }
        }
      } catch (err) {
        if (options.onEmitError) {
          options.onEmitError(err);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[backlog-gateway-emitter] Failed to emit event: ${msg}`);
        }
      }
    },
  };
}
