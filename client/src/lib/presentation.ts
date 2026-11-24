import type {
  BacklogItemType,
  BacklogMoscow,
  BacklogPriority,
  BacklogStatus,
} from '../../../shared/types.ts';

export const STATUS_META: Record<
  BacklogStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  raw: {
    label: 'Raw',
    dotClass: 'bg-zinc-400 dark:bg-zinc-500',
    badgeClass:
      'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  },
  groomed: {
    label: 'Groomed',
    dotClass: 'bg-sky-500',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  ready: {
    label: 'Ready',
    dotClass: 'bg-teal-600 dark:bg-teal-400',
    badgeClass:
      'bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  in_sprint: {
    label: 'In Sprint',
    dotClass: 'bg-amber-500',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  done: {
    label: 'Done',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

export const PRIORITY_BADGE_CLASS: Record<BacklogPriority, string> = {
  P0: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  P1: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  P2: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

export const TYPE_LABELS: Record<BacklogItemType, string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task',
  bug: 'Bug',
  tech_debt: 'Tech Debt',
};

export const TYPE_BADGE_CLASS: Record<BacklogItemType, string> = {
  epic: 'bg-violet-50 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  story:
    'bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 border-teal-200 dark:border-teal-800',
  task: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  bug: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  tech_debt:
    'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

export const MOSCOW_LABELS: Record<BacklogMoscow, string> = {
  must: 'Must',
  should: 'Should',
  could: 'Could',
  wont: "Won't",
};

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const ECOSYSTEM_LINKS = [
  {
    id: 'lms',
    label: 'LMS Psikotes',
    href:
      import.meta.env.VITE_LMS_URL ||
      (isLocalHost ? 'http://localhost:4100' : 'https://lokatalenta.vercel.app'),
    testId: 'switcher-link-lms',
    active: false,
  },
  {
    id: 'backlog',
    label: 'Backlog',
    href: import.meta.env.VITE_BACKLOG_URL || '/',
    testId: 'switcher-link-backlog',
    active: true,
  },
  {
    id: 'sprint-planner',
    label: 'Sprint Planner',
    href:
      import.meta.env.VITE_SPRINT_URL ||
      import.meta.env.VITE_SPRINT_PLANNER_URL ||
      (isLocalHost ? 'http://localhost:4103' : 'https://lokatalenta-sprint-planner.vercel.app'),
    testId: 'switcher-link-sprint-planner',
    active: false,
  },
  {
    id: 'docs',
    label: 'Docs Hub',
    href:
      import.meta.env.VITE_DOCS_URL ||
      (isLocalHost ? 'http://localhost:4104' : 'https://lokatalenta-docs.vercel.app'),
    testId: 'switcher-link-docs',
    active: false,
  },
  {
    id: 'office-3d',
    label: '3D Office',
    href:
      import.meta.env.VITE_OFFICE_3D_URL ||
      (isLocalHost ? 'http://localhost:4105' : 'https://lokatalenta-office-3d.vercel.app'),
    testId: 'switcher-link-office-3d',
    active: false,
  },
] as const;
