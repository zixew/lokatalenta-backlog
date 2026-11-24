export type DivisionId =
  | 'executive'
  | 'architecture'
  | 'engineering'
  | 'qa'
  | 'devops'
  | 'lounge';

export type TargetZone =
  | 'workspace'
  | 'boardroom'
  | 'cafeteria'
  | 'lobby'
  | 'lounge'
  | 'gym'
  | 'musholla';

export type TargetFloor = 1 | 2 | 3;

export type EventSeverity = 'info' | 'success' | 'warning' | 'alert';

export type BacklogItemType = 'epic' | 'story' | 'task' | 'bug' | 'tech_debt';

export type BacklogPriority = 'P0' | 'P1' | 'P2';

export type BacklogMoscow = 'must' | 'should' | 'could' | 'wont';

export type BacklogStatus = 'raw' | 'groomed' | 'ready' | 'in_sprint' | 'done';

export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

export interface BacklogItem {
  id: string;
  type: BacklogItemType;
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  storyPoints: number;
  priority: BacklogPriority;
  moscow: BacklogMoscow;
  status: BacklogStatus;
  ownerDivision: DivisionId;
  ownerAgentId: number;
  dependencies: string[];
  sprintId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBacklogItemInput {
  id?: string;
  type: BacklogItemType;
  title: string;
  description?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  storyPoints?: number;
  priority?: BacklogPriority;
  moscow?: BacklogMoscow;
  status?: BacklogStatus;
  ownerDivision: DivisionId;
  ownerAgentId: number;
  dependencies?: string[];
  sprintId?: string | null;
}

export interface UpdateBacklogItemInput {
  type?: BacklogItemType;
  title?: string;
  description?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  storyPoints?: number;
  priority?: BacklogPriority;
  moscow?: BacklogMoscow;
  status?: BacklogStatus;
  ownerDivision?: DivisionId;
  ownerAgentId?: number;
  dependencies?: string[];
  sprintId?: string | null;
}

export interface BacklogStats {
  total: number;
  byStatus: Record<BacklogStatus, number>;
  byDivision: Record<DivisionId, number>;
  byPriority: Record<BacklogPriority, number>;
  byType: Record<BacklogItemType, number>;
  totalStoryPoints: number;
  completedStoryPoints: number;
  groomedCount: number;
  assignedToSprintCount: number;
}

export interface DivisionContract {
  id: DivisionId;
  name: string;
  shortName: string;
  motto: string;
  color: string;
  defaultFloor: TargetFloor;
  defaultZone: TargetZone;
  agentIds: number[];
}

export interface AgentContract {
  id: number;
  name: string;
  shortName: string;
  role: string;
  divisionId: DivisionId;
  category: string;
  avatar: string;
  defaultZone: TargetZone;
  defaultFloor: TargetFloor;
}

export type BacklogEventAction =
  | 'backlog.created'
  | 'backlog.groomed'
  | 'backlog.updated'
  | 'backlog.deleted';

export interface NormalizedBacklogEvent {
  id: string;
  timestamp: string;
  source: 'backlog';
  type: 'backlog.updated';
  divisionId: DivisionId;
  agentId: number;
  entityId: string | null;
  title: string;
  summary: string;
  targetZone: TargetZone;
  targetFloor: TargetFloor;
  severity: EventSeverity;
  metadata: Record<string, unknown>;
}
