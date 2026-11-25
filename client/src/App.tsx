import { AlertCircle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BacklogItem,
  BacklogStats,
  BacklogStatus,
  CreateBacklogItemInput,
  UpdateBacklogItemInput,
} from '../../shared/types.ts';
import {
  createBacklogItemApi,
  deleteBacklogItemApi,
  fetchBacklogItems,
  fetchBacklogStats,
  getExportCsvUrl,
  updateBacklogItemApi,
} from './api/backlogApi.ts';
import { BacklogDetailDrawer } from './components/BacklogDetailDrawer.tsx';
import { BacklogListView } from './components/BacklogListView.tsx';
import { EcosystemHeader } from './components/EcosystemHeader.tsx';
import { EmptyState } from './components/EmptyState.tsx';
import { FilterToolbar } from './components/FilterToolbar.tsx';
import { ItemFormModal } from './components/ItemFormModal.tsx';
import { KanbanBoard } from './components/KanbanBoard.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { useTheme } from './hooks/useTheme.ts';

const EMPTY_STATS: BacklogStats = {
  total: 0,
  byStatus: { raw: 0, groomed: 0, ready: 0, in_sprint: 0, done: 0 },
  byDivision: {
    executive: 0,
    architecture: 0,
    engineering: 0,
    qa: 0,
    devops: 0,
    lounge: 0,
  },
  byPriority: { P0: 0, P1: 0, P2: 0 },
  byType: { epic: 0, story: 0, task: 0, bug: 0, tech_debt: 0 },
  totalStoryPoints: 0,
  completedStoryPoints: 0,
  groomedCount: 0,
  assignedToSprintCount: 0,
};

export function App() {
  const { isDark, toggleTheme } = useTheme();
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [allItems, setAllItems] = useState<BacklogItem[]>([]);
  const [stats, setStats] = useState<BacklogStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState('all');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [itemType, setItemType] = useState('all');
  const [quickPreset, setQuickPreset] = useState<'tech_debt_qa' | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [inspectingItem, setInspectingItem] = useState<BacklogItem | null>(null);

  const activeInspectItem = useMemo(() => {
    if (!inspectingItem) return null;
    return allItems.find((i) => i.id === inspectingItem.id) ?? inspectingItem;
  }, [inspectingItem, allItems]);

  const activeFilters = useMemo(
    () => ({
      q: search,
      division,
      status,
      priority,
      type: itemType,
    }),
    [search, division, status, priority, itemType],
  );

  const hasActiveFilters =
    quickPreset !== null ||
    search.trim() !== '' ||
    division !== 'all' ||
    status !== 'all' ||
    priority !== 'all' ||
    itemType !== 'all';

  const displayedItems = useMemo(() => {
    if (quickPreset === 'tech_debt_qa') {
      return items.filter(
        (item) => item.type === 'tech_debt' || item.ownerDivision === 'qa',
      );
    }
    return items;
  }, [items, quickPreset]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedStoryPoints = useMemo(
    () =>
      allItems
        .filter((item) => selectedSet.has(item.id))
        .reduce((sum, item) => sum + item.storyPoints, 0),
    [allItems, selectedSet],
  );

  const loadData = useCallback(async () => {
    try {
      const [filteredItems, unfilteredItems, nextStats] = await Promise.all([
        fetchBacklogItems(activeFilters),
        fetchBacklogItems({}),
        fetchBacklogStats(),
      ]);
      setErrorBanner(null);
      setItems(filteredItems);
      setAllItems(unfilteredItems);
      setStats(nextStats);
      const validIds = new Set(unfilteredItems.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load backlog');
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    let cancelled = false;

    async function syncBacklog() {
      try {
        const [filteredItems, unfilteredItems, nextStats] = await Promise.all([
          fetchBacklogItems(activeFilters),
          fetchBacklogItems({}),
          fetchBacklogStats(),
        ]);
        if (cancelled) return;
        setErrorBanner(null);
        setItems(filteredItems);
        setAllItems(unfilteredItems);
        setStats(nextStats);
      } catch (err) {
        if (cancelled) return;
        setErrorBanner(err instanceof Error ? err.message : 'Failed to load backlog');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncBacklog();

    return () => {
      cancelled = true;
    };
  }, [activeFilters]);

  const handleResetFilters = () => {
    setQuickPreset(null);
    setSearch('');
    setDivision('all');
    setStatus('all');
    setPriority('all');
    setItemType('all');
  };

  const handleTechDebtQaPreset = () => {
    handleResetFilters();
    setQuickPreset('tech_debt_qa');
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  }, []);

  const handleToggleSelectAll = useCallback((visibleIds: string[]) => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      if (allSelected) {
        const visibleSet = new Set(visibleIds);
        return prev.filter((id) => !visibleSet.has(id));
      }
      const merged = [...prev];
      for (const id of visibleIds) {
        if (!prevSet.has(id)) {
          merged.push(id);
        }
      }
      return merged;
    });
  }, []);

  const handleBulkStatusUpdate = async (nextStatus: BacklogStatus) => {
    if (selectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setErrorBanner(null);
    const failedIds: string[] = [];
    let firstError: string | null = null;
    for (const id of selectedIds) {
      try {
        await updateBacklogItemApi(id, { status: nextStatus });
      } catch (err) {
        failedIds.push(id);
        if (!firstError) {
          firstError = err instanceof Error ? err.message : 'Failed to update status';
        }
      }
    }
    await loadData();
    setSelectedIds(failedIds);
    if (firstError) {
      setErrorBanner(firstError);
    }
    setBulkBusy(false);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: BacklogItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleCreate = async (input: CreateBacklogItemInput) => {
    await createBacklogItemApi(input);
    await loadData();
  };

  const handleUpdate = async (id: string, input: UpdateBacklogItemInput) => {
    await updateBacklogItemApi(id, input);
    await loadData();
  };

  const handleStatusChange = async (id: string, nextStatus: BacklogStatus) => {
    try {
      setErrorBanner(null);
      await updateBacklogItemApi(id, { status: nextStatus });
      await loadData();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setErrorBanner(null);
      await deleteBacklogItemApi(id);
      await loadData();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F3F3F0] text-[#0E1015] dark:bg-[#0E1015] dark:text-slate-100">
      <EcosystemHeader
        isDark={isDark}
        onToggleTheme={toggleTheme}
        totalItems={stats.total}
      />

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-5 sm:px-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-slate-100">
              Multi-Agent Product Backlog
            </h1>
            <p className="text-sm text-zinc-600 dark:text-slate-400">
              Prioritize Epics, Stories, Tasks, Bugs, and Tech Debt across all 6 LokaTalenta
              divisions.
            </p>
          </div>
        </div>

        <StatsBar
          stats={stats}
          activeDivision={division}
          onSelectDivision={setDivision}
          allItems={allItems}
        />

        <FilterToolbar
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          search={search}
          onSearchChange={setSearch}
          division={division}
          onDivisionChange={setDivision}
          status={status}
          onStatusChange={setStatus}
          priority={priority}
          onPriorityChange={setPriority}
          itemType={itemType}
          onItemTypeChange={setItemType}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          onCreateItem={handleOpenCreate}
          exportCsvUrl={getExportCsvUrl(activeFilters)}
          isTechDebtQaActive={quickPreset === 'tech_debt_qa'}
          onTechDebtQaPreset={handleTechDebtQaPreset}
        />

        {selectedIds.length > 0 && (
          <div
            data-testid="bulk-action-bar"
            role="region"
            aria-label="Bulk selection actions"
            className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[#0F766E] bg-teal-50/95 px-3.5 py-2.5 shadow-sm backdrop-blur-xs dark:border-teal-500 dark:bg-teal-950/90"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0F766E] dark:text-teal-200">
              <span className="font-mono-tabular">
                {selectedIds.length} selected
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{selectedStoryPoints} SP</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-zinc-600 dark:text-slate-300">
                Set status:
              </span>
              <button
                type="button"
                data-testid="bulk-status-ready"
                disabled={bulkBusy}
                onClick={() => void handleBulkStatusUpdate('ready')}
                className="inline-flex min-h-[34px] items-center rounded-md border border-[#0F766E] bg-[#0F766E] px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#115E59] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:bg-teal-600 dark:hover:bg-teal-500"
              >
                Ready
              </button>
              <button
                type="button"
                data-testid="bulk-status-groomed"
                disabled={bulkBusy}
                onClick={() => void handleBulkStatusUpdate('groomed')}
                className="inline-flex min-h-[34px] items-center rounded-md border border-[#E5E3DC] bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 transition-colors hover:bg-[#F6F5F1] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100 dark:hover:bg-zinc-800"
              >
                Groomed
              </button>
              <button
                type="button"
                data-testid="bulk-status-in_sprint"
                disabled={bulkBusy}
                onClick={() => void handleBulkStatusUpdate('in_sprint')}
                className="inline-flex min-h-[34px] items-center rounded-md border border-[#E5E3DC] bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 transition-colors hover:bg-[#F6F5F1] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-100 dark:hover:bg-zinc-800"
              >
                In Sprint
              </button>
              <button
                type="button"
                data-testid="bulk-clear-btn"
                disabled={bulkBusy}
                onClick={() => setSelectedIds([])}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-white/70 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:text-slate-300 dark:hover:bg-zinc-900/60"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {loading ? (
          <div
            aria-busy="true"
            aria-label="Loading backlog items"
            className="space-y-4"
          >
            <div className="h-10 w-72 rounded-lg bg-[#EAEAE4] dark:bg-zinc-800/70 animate-pulse" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[0, 1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-64 rounded-lg border border-[#D4D4CE] dark:border-zinc-800 bg-white dark:bg-[#161B24] p-3 space-y-3 animate-pulse"
                >
                  <div className="h-4 w-1/2 rounded bg-[#EAEAE4] dark:bg-zinc-800" />
                  <div className="h-16 rounded bg-[#EAEAE4] dark:bg-zinc-800" />
                  <div className="h-16 rounded bg-[#EAEAE4] dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        ) : displayedItems.length === 0 ? (
          <EmptyState
            filtered={hasActiveFilters}
            onCreateItem={handleOpenCreate}
            onResetFilters={handleResetFilters}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            items={displayedItems}
            onStatusChange={handleStatusChange}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onInspect={setInspectingItem}
            selectedIds={selectedSet}
            onToggleSelect={handleToggleSelect}
          />
        ) : (
          <BacklogListView
            items={displayedItems}
            onStatusChange={handleStatusChange}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            selectedIds={selectedSet}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        )}
      </main>

      <BacklogDetailDrawer
        item={activeInspectItem}
        onClose={() => setInspectingItem(null)}
        onQuickUpdate={handleUpdate}
        onOpenFullEdit={handleOpenEdit}
      />

      {modalOpen && (
        <ItemFormModal
          editingItem={editingItem}
          allItems={allItems}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
