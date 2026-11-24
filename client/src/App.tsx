import { AlertCircle } from 'lucide-react';
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

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
    search.trim() !== '' ||
    division !== 'all' ||
    status !== 'all' ||
    priority !== 'all' ||
    itemType !== 'all';

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
    setSearch('');
    setDivision('all');
    setStatus('all');
    setPriority('all');
    setItemType('all');
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
    <div className="min-h-screen bg-[#F6F5F1] text-[#18181B] dark:bg-[#0D1117] dark:text-slate-100">
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
        />

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
          <div className="rounded-lg border border-[#E5E3DC] bg-white p-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-[#161B22] dark:text-slate-400">
            Loading backlog items...
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            filtered={hasActiveFilters}
            onCreateItem={handleOpenCreate}
            onResetFilters={handleResetFilters}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            items={items}
            onStatusChange={handleStatusChange}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        ) : (
          <BacklogListView
            items={items}
            onStatusChange={handleStatusChange}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
      </main>

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
