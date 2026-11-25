import { BACKLOG_STATUSES } from '../../../shared/contracts.ts';
import type { BacklogItem, BacklogStatus } from '../../../shared/types.ts';
import { STATUS_META } from '../lib/presentation.ts';
import { BacklogItemCard } from './BacklogItemCard.tsx';

interface KanbanBoardProps {
  items: BacklogItem[];
  onStatusChange: (id: string, status: BacklogStatus) => Promise<void>;
  onEdit: (item: BacklogItem) => void;
  onDelete: (id: string) => Promise<void>;
  onInspect?: (item: BacklogItem) => void;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
}

export function KanbanBoard({
  items,
  onStatusChange,
  onEdit,
  onDelete,
  onInspect,
  selectedIds,
  onToggleSelect,
}: KanbanBoardProps) {
  return (
    <div
      data-testid="kanban-board"
      className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-5 xl:auto-cols-auto"
    >
      {BACKLOG_STATUSES.map((status) => {
        const colItems = items.filter((item) => item.status === status);
        const spTotal = colItems.reduce((sum, item) => sum + item.storyPoints, 0);
        const meta = STATUS_META[status];

        return (
          <section
            key={status}
            data-testid={`kanban-column-${status}`}
            aria-label={`${meta.label} column`}
            className="flex min-h-[260px] flex-col rounded-lg border border-[#E5E3DC] bg-[#FAF9F6] p-2.5 dark:border-zinc-800 dark:bg-[#11161E]"
          >
            <header className="mb-2.5 flex items-center justify-between border-b border-[#E5E3DC] pb-2 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-slate-200">
                  {meta.label}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 font-mono-tabular dark:text-slate-400">
                <span>{colItems.length}</span>
                <span>·</span>
                <span>{spTotal} SP</span>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-2.5">
              {colItems.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-[#E5E3DC] px-3 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-slate-500">
                  No items in {meta.label}
                </div>
              ) : (
                colItems.map((item) => (
                  <BacklogItemCard
                    key={item.id}
                    item={item}
                    onStatusChange={onStatusChange}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onInspect={onInspect}
                    selected={selectedIds?.has(item.id) ?? false}
                    onToggleSelect={onToggleSelect}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
