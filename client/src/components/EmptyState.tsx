import { Inbox, Plus, RotateCcw } from 'lucide-react';

interface EmptyStateProps {
  filtered: boolean;
  onCreateItem: () => void;
  onResetFilters: () => void;
}

export function EmptyState({
  filtered,
  onCreateItem,
  onResetFilters,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E3DC] bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-[#161B22]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E3DC] bg-[#F6F5F1] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        <Inbox className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-bold text-zinc-900 dark:text-slate-100">
        {filtered ? 'No matching backlog items' : 'Backlog is clean and empty'}
      </h2>
      <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-slate-400">
        {filtered
          ? 'No items match the current search or division/status filters. Reset filters or create a new backlog item.'
          : 'Create your first Epic, Story, Task, Bug, or Tech Debt item with Given-When-Then acceptance criteria and canonical division ownership.'}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {filtered && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E5E3DC] bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-all duration-200 ease-out hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[38px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Filters</span>
          </button>
        )}
        <button
          type="button"
          onClick={onCreateItem}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-out hover:bg-[#115E59] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[38px] dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Create Backlog Item</span>
        </button>
      </div>
    </div>
  );
}
