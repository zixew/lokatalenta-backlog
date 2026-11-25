import { useEffect, useRef } from 'react';
import { Download, LayoutGrid, List, Plus, RotateCcw, Search } from 'lucide-react';
import {
  BACKLOG_ITEM_TYPES,
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  CANONICAL_DIVISIONS,
} from '../../../shared/contracts.ts';
import { STATUS_META, TYPE_LABELS } from '../lib/presentation.ts';

interface FilterToolbarProps {
  viewMode: 'kanban' | 'list';
  onChangeViewMode: (mode: 'kanban' | 'list') => void;
  search: string;
  onSearchChange: (value: string) => void;
  division: string;
  onDivisionChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  itemType: string;
  onItemTypeChange: (value: string) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onCreateItem: () => void;
  exportCsvUrl: string;
}

export function FilterToolbar({
  viewMode,
  onChangeViewMode,
  search,
  onSearchChange,
  division,
  onDivisionChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  itemType,
  onItemTypeChange,
  hasActiveFilters,
  onResetFilters,
  onCreateItem,
  exportCsvUrl,
}: FilterToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <section
      aria-label="Filter and actions"
      className="rounded-lg border border-[#E5E3DC] bg-white p-3 dark:border-zinc-800 dark:bg-[#161B22]"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E5E3DC] bg-[#F6F5F1] p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              data-testid="view-tab-kanban"
              aria-pressed={viewMode === 'kanban'}
              onClick={() => onChangeViewMode('kanban')}
              className={
                viewMode === 'kanban'
                  ? 'inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#0F766E] shadow-xs transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[32px] dark:bg-[#161B22] dark:text-teal-400'
                  : 'inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all duration-200 ease-out hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[32px] dark:text-slate-400 dark:hover:text-slate-200'
              }
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              data-testid="view-tab-list"
              aria-pressed={viewMode === 'list'}
              onClick={() => onChangeViewMode('list')}
              className={
                viewMode === 'list'
                  ? 'inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#0F766E] shadow-xs transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[32px] dark:bg-[#161B22] dark:text-teal-400'
                  : 'inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all duration-200 ease-out hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[32px] dark:text-slate-400 dark:hover:text-slate-200'
              }
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>

          <div className="relative w-full sm:w-auto sm:min-w-[210px]">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              ref={searchInputRef}
              type="search"
              data-testid="filter-search"
              aria-label="Search backlog items"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search ID, title, notes..."
              className="min-h-[44px] w-full rounded-lg border border-[#E5E3DC] bg-white py-1.5 pr-9 pl-8 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
            />
            {!search ? (
              <kbd
                onClick={() => searchInputRef.current?.focus()}
                title="Press / to focus search"
                className="font-mono-tabular absolute top-1/2 right-2.5 hidden -translate-y-1/2 cursor-pointer select-none rounded border border-[#E5E3DC] bg-[#F6F5F1] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-400 sm:inline-block"
              >
                /
              </kbd>
            ) : null}
          </div>

          <select
            data-testid="filter-division"
            aria-label="Filter by division"
            value={division}
            onChange={(e) => onDivisionChange(e.target.value)}
            className="min-h-[44px] max-w-full rounded-lg border border-[#E5E3DC] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
          >
            <option value="all">All Divisions</option>
            {CANONICAL_DIVISIONS.map((div) => (
              <option key={div.id} value={div.id}>
                {div.shortName}
              </option>
            ))}
          </select>

          <select
            data-testid="filter-status"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="min-h-[44px] max-w-full rounded-lg border border-[#E5E3DC] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            {BACKLOG_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </select>

          <select
            data-testid="filter-priority"
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="min-h-[44px] max-w-full rounded-lg border border-[#E5E3DC] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
          >
            <option value="all">All Priorities</option>
            {BACKLOG_PRIORITIES.map((prio) => (
              <option key={prio} value={prio}>
                {prio}
              </option>
            ))}
          </select>

          <select
            data-testid="filter-type"
            aria-label="Filter by type"
            value={itemType}
            onChange={(e) => onItemTypeChange(e.target.value)}
            className="min-h-[44px] max-w-full rounded-lg border border-[#E5E3DC] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#0F766E] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100"
          >
            <option value="all">All Types</option>
            {BACKLOG_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              data-testid="clear-filters-btn"
              onClick={onResetFilters}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#E5E3DC] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-all duration-200 ease-out hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportCsvUrl}
            download="lokatalenta-backlog.csv"
            data-testid="export-csv-btn"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E5E3DC] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-all duration-200 ease-out hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 lg:min-h-[36px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            type="button"
            data-testid="create-item-btn"
            onClick={onCreateItem}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#0F766E] px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 ease-out hover:bg-[#115E59] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 lg:min-h-[36px] dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            <span>New Item</span>
          </button>
        </div>
      </div>
    </section>
  );
}
