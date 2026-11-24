import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { AGENT_MAP, BACKLOG_STATUSES, DIVISION_MAP } from '../../../shared/contracts.ts';
import type { BacklogItem, BacklogStatus } from '../../../shared/types.ts';
import {
  MOSCOW_LABELS,
  PRIORITY_BADGE_CLASS,
  STATUS_META,
  TYPE_BADGE_CLASS,
  TYPE_LABELS,
} from '../lib/presentation.ts';

interface BacklogListViewProps {
  items: BacklogItem[];
  onStatusChange: (id: string, status: BacklogStatus) => Promise<void>;
  onEdit: (item: BacklogItem) => void;
  onDelete: (id: string) => Promise<void>;
}

export function BacklogListView({
  items,
  onStatusChange,
  onEdit,
  onDelete,
}: BacklogListViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, nextStatus: BacklogStatus) => {
    setBusyId(id);
    try {
      await onStatusChange(id, nextStatus);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDelete(id);
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div
      data-testid="backlog-list"
      className="overflow-x-auto rounded-lg border border-[#E5E3DC] bg-white dark:border-zinc-800 dark:bg-[#161B22]"
    >
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#E5E3DC] bg-[#FAF9F6] text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-[#11161E] dark:text-slate-400">
            <th className="px-3.5 py-2.5">ID</th>
            <th className="px-3.5 py-2.5">Type</th>
            <th className="px-3.5 py-2.5">Title</th>
            <th className="px-3.5 py-2.5">Status</th>
            <th className="px-3.5 py-2.5">Priority</th>
            <th className="px-3.5 py-2.5">MoSCoW</th>
            <th className="px-3.5 py-2.5 text-right">SP</th>
            <th className="px-3.5 py-2.5">Division &amp; Owner</th>
            <th className="px-3.5 py-2.5">ACs / Deps</th>
            <th className="px-3.5 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E3DC] dark:divide-zinc-800">
          {items.map((item) => {
            const division = DIVISION_MAP.get(item.ownerDivision);
            const agent = AGENT_MAP.get(item.ownerAgentId);
            const isBusy = busyId === item.id;
            const isConfirming = confirmDeleteId === item.id;

            return (
              <tr
                key={item.id}
                data-testid={`backlog-row-${item.id}`}
                className="transition-colors hover:bg-[#FAF9F6] dark:hover:bg-zinc-900/50"
              >
                <td className="px-3.5 py-3 align-top text-xs font-bold text-zinc-900 font-mono-tabular dark:text-slate-100">
                  {item.id}
                </td>
                <td className="px-3.5 py-3 align-top">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE_CLASS[item.type]}`}
                  >
                    {TYPE_LABELS[item.type]}
                  </span>
                </td>
                <td className="max-w-xs px-3.5 py-3 align-top">
                  <div className="font-semibold text-zinc-900 dark:text-slate-100">
                    {item.title}
                  </div>
                  {item.sprintId && (
                    <span className="mt-1 inline-block rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium text-[#0F766E] font-mono-tabular dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                      {item.sprintId}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-3 align-top">
                  <select
                    data-testid={`card-status-select-${item.id}`}
                    aria-label={`Change status for ${item.id}`}
                    disabled={isBusy}
                    value={item.status}
                    onChange={(e) => {
                      void handleStatusChange(item.id, e.target.value as BacklogStatus);
                    }}
                    className="min-h-[34px] rounded-md border border-[#E5E3DC] bg-white px-2 py-1 text-xs font-medium text-zinc-800 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
                  >
                    {BACKLOG_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {STATUS_META[st].label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3.5 py-3 align-top">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold font-mono-tabular ${PRIORITY_BADGE_CLASS[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="px-3.5 py-3 align-top text-xs text-zinc-700 dark:text-slate-300">
                  {MOSCOW_LABELS[item.moscow]}
                </td>
                <td className="px-3.5 py-3 text-right align-top text-xs font-semibold text-zinc-900 font-mono-tabular dark:text-slate-100">
                  {item.storyPoints}
                </td>
                <td className="px-3.5 py-3 align-top text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-slate-200">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: division?.color ?? '#64748b' }}
                    />
                    <span>{division?.shortName ?? item.ownerDivision}</span>
                  </div>
                  <div className="mt-0.5 text-zinc-600 dark:text-slate-400">
                    #{item.ownerAgentId} {agent?.shortName ?? 'Agent'}
                  </div>
                </td>
                <td className="px-3.5 py-3 align-top text-xs text-zinc-600 font-mono-tabular dark:text-slate-400">
                  <div>{item.acceptanceCriteria.length} ACs</div>
                  {item.dependencies.length > 0 && (
                    <div className="mt-0.5 text-[11px]">
                      Deps: {item.dependencies.join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-3.5 py-3 text-right align-top">
                  {isConfirming ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`confirm-delete-btn-${item.id}`}
                        disabled={isBusy}
                        onClick={() => {
                          void handleConfirmDelete(item.id);
                        }}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-md bg-[#E11D48] px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="Cancel delete"
                        className="inline-flex min-h-[32px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`edit-item-btn-${item.id}`}
                        aria-label={`Edit ${item.id}`}
                        onClick={() => onEdit(item)}
                        className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white text-zinc-700 hover:bg-[#F6F5F1] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-item-btn-${item.id}`}
                        aria-label={`Delete ${item.id}`}
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white text-rose-700 hover:bg-rose-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
