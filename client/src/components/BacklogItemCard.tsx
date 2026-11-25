import { Check, Link2, Pencil, Trash2, X } from 'lucide-react';
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

interface BacklogItemCardProps {
  item: BacklogItem;
  onStatusChange: (id: string, status: BacklogStatus) => Promise<void>;
  onEdit: (item: BacklogItem) => void;
  onDelete: (id: string) => Promise<void>;
  onInspect?: (item: BacklogItem) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function BacklogItemCard({
  item,
  onStatusChange,
  onEdit,
  onDelete,
  onInspect,
  selected = false,
  onToggleSelect,
}: BacklogItemCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const division = DIVISION_MAP.get(item.ownerDivision);
  const agent = AGENT_MAP.get(item.ownerAgentId);

  const handleStatusChange = async (nextStatus: BacklogStatus) => {
    if (nextStatus === item.status) return;
    setBusy(true);
    try {
      await onStatusChange(item.id, nextStatus);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await onDelete(item.id);
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <article
      data-testid={`backlog-card-${item.id}`}
      onClick={() => onInspect?.(item)}
      className={`rounded-lg border bg-white p-3.5 transition-all duration-200 ease-out dark:bg-[#161B22] ${
        selected
          ? 'border-[#0F766E] ring-1 ring-[#0F766E]/30 dark:border-teal-500 dark:ring-teal-500/30'
          : 'border-[#E5E3DC] hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      } ${onInspect ? 'cursor-pointer hover:shadow-xs' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <input
              type="checkbox"
              data-testid={`select-item-${item.id}`}
              aria-label={`Select ${item.id}`}
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSelect(item.id)}
              className="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 dark:border-zinc-600"
            />
          )}
          <span className="text-xs font-bold text-zinc-900 font-mono-tabular dark:text-slate-100">
            {item.id}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE_CLASS[item.type]}`}
          >
            {TYPE_LABELS[item.type]}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold font-mono-tabular ${PRIORITY_BADGE_CLASS[item.priority]}`}
          >
            {item.priority}
          </span>
          <span className="rounded-full border border-[#E5E3DC] bg-[#F6F5F1] px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {MOSCOW_LABELS[item.moscow]}
          </span>
        </div>
      </div>

      <h3 className="mt-2 text-sm leading-snug font-semibold text-zinc-900 dark:text-slate-100">
        {item.title}
      </h3>

      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-slate-400">
          {item.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E3DC] pt-2.5 text-xs dark:border-zinc-800">
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-slate-300">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: division?.color ?? '#64748b' }}
          />
          <span className="truncate font-medium">
            #{item.ownerAgentId} {agent?.shortName ?? 'Agent'}
          </span>
        </div>
        <span className="rounded border border-[#E5E3DC] bg-[#F6F5F1] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-800 font-mono-tabular dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-200">
          {item.storyPoints} SP
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 dark:text-slate-400">
        <span className="rounded border border-[#E5E3DC] px-1.5 py-0.5 font-mono-tabular dark:border-zinc-800">
          {item.acceptanceCriteria.length} ACs
        </span>
        {item.sprintId && (
          <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-medium text-[#0F766E] font-mono-tabular dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
            {item.sprintId}
          </span>
        )}
        {item.dependencies.map((depId) => (
          <span
            key={depId}
            className="inline-flex items-center gap-1 rounded border border-[#E5E3DC] bg-[#F6F5F1] px-1.5 py-0.5 text-zinc-700 font-mono-tabular dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <Link2 className="h-3 w-3" />
            {depId}
          </span>
        ))}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-3 flex items-center justify-between gap-2 border-t border-[#E5E3DC] pt-2.5 dark:border-zinc-800"
      >
        <select
          data-testid={`card-status-select-${item.id}`}
          aria-label={`Change status for ${item.id}`}
          disabled={busy}
          value={item.status}
          onChange={(e) => {
            void handleStatusChange(e.target.value as BacklogStatus);
          }}
          className="min-h-[38px] rounded-md border border-[#E5E3DC] bg-white px-2 py-1 text-xs font-medium text-zinc-800 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
        >
          {BACKLOG_STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_META[st].label}
            </option>
          ))}
        </select>

        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid={`confirm-delete-btn-${item.id}`}
              disabled={busy}
              onClick={() => {
                void handleConfirmDelete();
              }}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-md bg-[#E11D48] px-2 py-1 text-xs font-semibold text-white transition-all duration-200 ease-out hover:bg-rose-700 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 lg:min-h-[30px]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Confirm</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
              aria-label="Cancel delete"
              className="inline-flex min-h-[38px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-[#F6F5F1] lg:min-h-[30px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid={`edit-item-btn-${item.id}`}
              aria-label={`Edit ${item.id}`}
              onClick={() => onEdit(item)}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white px-2 text-zinc-700 transition-all duration-200 ease-out hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] lg:min-w-[30px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-testid={`delete-item-btn-${item.id}`}
              aria-label={`Delete ${item.id}`}
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md border border-[#E5E3DC] bg-white px-2 text-rose-700 transition-all duration-200 ease-out hover:border-rose-200 hover:bg-rose-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 lg:min-h-[30px] lg:min-w-[30px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
