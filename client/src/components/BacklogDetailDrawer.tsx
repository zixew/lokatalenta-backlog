import { Calendar, CheckCircle2, Link2, Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AGENT_MAP,
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  DIVISION_MAP,
} from '../../../shared/contracts.ts';
import type {
  BacklogItem,
  BacklogPriority,
  BacklogStatus,
  UpdateBacklogItemInput,
} from '../../../shared/types.ts';
import {
  MOSCOW_LABELS,
  PRIORITY_BADGE_CLASS,
  STATUS_META,
  TYPE_BADGE_CLASS,
  TYPE_LABELS,
} from '../lib/presentation.ts';

interface BacklogDetailDrawerProps {
  item: BacklogItem | null;
  onClose: () => void;
  onQuickUpdate: (id: string, input: UpdateBacklogItemInput) => Promise<void>;
  onOpenFullEdit: (item: BacklogItem) => void;
}

export function BacklogDetailDrawer({
  item,
  onClose,
  onQuickUpdate,
  onOpenFullEdit,
}: BacklogDetailDrawerProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const division = DIVISION_MAP.get(item.ownerDivision);
  const agent = AGENT_MAP.get(item.ownerAgentId);

  const handleStatusClick = async (nextStatus: BacklogStatus) => {
    if (nextStatus === item.status || busy) return;
    setBusy(true);
    try {
      await onQuickUpdate(item.id, { status: nextStatus });
    } finally {
      setBusy(false);
    }
  };

  const handlePriorityClick = async (nextPriority: BacklogPriority) => {
    if (nextPriority === item.priority || busy) return;
    setBusy(true);
    try {
      await onQuickUpdate(item.id, { priority: nextPriority });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[4px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${item.id}`}
      data-testid="backlog-detail-drawer"
    >
      <aside
        className="transition-drawer-enter flex h-full w-full max-w-xl flex-col border-l border-[#D4D4CE] bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#161B24]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#D4D4CE] bg-[#F3F3F0] px-5 py-4 dark:border-zinc-800 dark:bg-[#11161E]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono-tabular text-xs font-bold text-zinc-900 dark:text-slate-100">
                {item.id}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE_CLASS[item.type]}`}
              >
                {TYPE_LABELS[item.type]}
              </span>
              <span className="font-mono-tabular rounded border border-[#E5E3DC] bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200">
                {item.storyPoints} SP
              </span>
              {item.sprintId ? (
                <span className="font-mono-tabular rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-[#0F766E] dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                  {item.sprintId}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-lg font-bold leading-snug text-zinc-900 dark:text-slate-100">
              {item.title}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              data-testid="drawer-full-edit-btn"
              onClick={() => {
                onClose();
                onOpenFullEdit(item);
              }}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#E5E3DC] bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-[#F6F5F1] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Full Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail drawer"
              data-testid="drawer-close-btn"
              className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white text-zinc-600 transition-colors hover:bg-[#F6F5F1] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* One-click Status & Priority controls */}
          <section className="space-y-3 rounded-lg border border-[#E5E3DC] bg-[#FAF9F6]/70 p-3.5 dark:border-zinc-800 dark:bg-[#0D1117]">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
                One-Click Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BACKLOG_STATUSES.map((st) => {
                  const active = item.status === st;
                  const meta = STATUS_META[st];
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={busy}
                      data-testid={`drawer-status-${st}`}
                      onClick={() => void handleStatusClick(st)}
                      className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                        active
                          ? 'border-[#0F766E] bg-teal-50 text-[#0F766E] dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                          : 'border-[#E5E3DC] bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#161B22] dark:text-slate-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
                One-Click Priority
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BACKLOG_PRIORITIES.map((prio) => {
                  const active = item.priority === prio;
                  return (
                    <button
                      key={prio}
                      type="button"
                      disabled={busy}
                      data-testid={`drawer-priority-${prio}`}
                      onClick={() => void handlePriorityClick(prio)}
                      className={`font-mono-tabular inline-flex min-h-[30px] items-center rounded-md border px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                        active
                          ? PRIORITY_BADGE_CLASS[prio]
                          : 'border-[#E5E3DC] bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#161B22] dark:text-slate-400 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {prio}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Description */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
              Description
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-slate-300">
              {item.description || 'No description provided.'}
            </p>
          </section>

          {/* Metadata */}
          <section className="grid grid-cols-2 gap-3 rounded-lg border border-[#E5E3DC] p-3.5 text-xs dark:border-zinc-800">
            <div>
              <span className="block text-[11px] font-medium text-zinc-500 dark:text-slate-400">
                Owner Division
              </span>
              <div className="mt-1 flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-slate-100">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: division?.color ?? '#64748b' }}
                />
                <span>{division?.name ?? item.ownerDivision}</span>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-zinc-500 dark:text-slate-400">
                Assignee
              </span>
              <p className="mt-1 font-semibold text-zinc-900 dark:text-slate-100">
                #{item.ownerAgentId} {agent?.name ?? 'Agent'}
              </p>
              {agent?.role ? (
                <p className="text-[11px] text-zinc-500 dark:text-slate-400">{agent.role}</p>
              ) : null}
            </div>

            <div>
              <span className="block text-[11px] font-medium text-zinc-500 dark:text-slate-400">
                MoSCoW Classification
              </span>
              <p className="mt-1 font-semibold text-zinc-900 dark:text-slate-100">
                {MOSCOW_LABELS[item.moscow]}
              </p>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-zinc-500 dark:text-slate-400">
                Updated
              </span>
              <p className="mt-1 inline-flex items-center gap-1 font-mono-tabular text-zinc-700 dark:text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                {new Date(item.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </section>

          {/* Dependencies */}
          {item.dependencies.length > 0 ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
                Dependencies ({item.dependencies.length})
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.dependencies.map((depId) => (
                  <span
                    key={depId}
                    className="font-mono-tabular inline-flex items-center gap-1 rounded-md border border-[#E5E3DC] bg-[#F6F5F1] px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {depId}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {/* Given-When-Then Acceptance Criteria */}
          <section>
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
              Acceptance Criteria ({item.acceptanceCriteria.length})
            </h3>
            {item.acceptanceCriteria.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-[#E5E3DC] p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-slate-400">
                No Given-When-Then criteria defined yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {item.acceptanceCriteria.map((ac, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border border-[#E5E3DC] bg-[#FAF9F6]/70 p-3 text-xs leading-relaxed dark:border-zinc-800 dark:bg-[#0D1117]"
                  >
                    <p>
                      <span className="font-mono-tabular font-bold text-[#0F766E] dark:text-teal-400">
                        GIVEN
                      </span>{' '}
                      <span className="text-zinc-800 dark:text-slate-200">{ac.given}</span>
                    </p>
                    <p className="mt-1">
                      <span className="font-mono-tabular font-bold text-amber-700 dark:text-amber-400">
                        WHEN
                      </span>{' '}
                      <span className="text-zinc-800 dark:text-slate-200">{ac.when}</span>
                    </p>
                    <p className="mt-1">
                      <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                        THEN
                      </span>{' '}
                      <span className="text-zinc-800 dark:text-slate-200">{ac.then}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
