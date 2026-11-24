import { CANONICAL_DIVISIONS } from '../../../shared/contracts.ts';
import type { BacklogStats, DivisionId } from '../../../shared/types.ts';

interface StatsBarProps {
  stats: BacklogStats;
  activeDivision: string;
  onSelectDivision: (divisionId: string) => void;
}

export function StatsBar({
  stats,
  activeDivision,
  onSelectDivision,
}: StatsBarProps) {
  const readyAndGroomed = stats.byStatus.groomed + stats.byStatus.ready;
  const inSprintOrDone = stats.byStatus.in_sprint + stats.byStatus.done;

  const handleDivisionClick = (divisionId: DivisionId) => {
    onSelectDivision(activeDivision === divisionId ? 'all' : divisionId);
  };

  return (
    <section aria-label="Backlog summary" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          data-testid="stat-total-items"
          className="rounded-lg border border-[#E5E3DC] bg-white p-4 dark:border-zinc-800 dark:bg-[#161B22]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-slate-400">
            Total Items
          </p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900 font-mono-tabular dark:text-slate-100">
            {stats.total}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
            P0: <span className="font-mono-tabular font-semibold">{stats.byPriority.P0}</span> ·
            P1: <span className="font-mono-tabular font-semibold">{stats.byPriority.P1}</span>
          </p>
        </div>

        <div
          data-testid="stat-total-sp"
          className="rounded-lg border border-[#E5E3DC] bg-white p-4 dark:border-zinc-800 dark:bg-[#161B22]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-slate-400">
            Story Points
          </p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900 font-mono-tabular dark:text-slate-100">
            {stats.totalStoryPoints}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
            Completed:{' '}
            <span className="font-mono-tabular font-semibold text-[#0F766E] dark:text-teal-400">
              {stats.completedStoryPoints} SP
            </span>
          </p>
        </div>

        <div
          data-testid="stat-ready-count"
          className="rounded-lg border border-[#E5E3DC] bg-white p-4 dark:border-zinc-800 dark:bg-[#161B22]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-slate-400">
            Groomed &amp; Ready
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#0F766E] font-mono-tabular dark:text-teal-400">
            {readyAndGroomed}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
            Ready: <span className="font-mono-tabular font-semibold">{stats.byStatus.ready}</span> ·
            Raw: <span className="font-mono-tabular font-semibold">{stats.byStatus.raw}</span>
          </p>
        </div>

        <div
          data-testid="stat-done-count"
          className="rounded-lg border border-[#E5E3DC] bg-white p-4 dark:border-zinc-800 dark:bg-[#161B22]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-slate-400">
            In Sprint / Done
          </p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900 font-mono-tabular dark:text-slate-100">
            {inSprintOrDone}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-slate-400">
            Sprint:{' '}
            <span className="font-mono-tabular font-semibold">{stats.byStatus.in_sprint}</span> ·
            Done: <span className="font-mono-tabular font-semibold">{stats.byStatus.done}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CANONICAL_DIVISIONS.map((division) => {
          const isSelected = activeDivision === division.id;
          const count = stats.byDivision[division.id] ?? 0;
          return (
            <button
              key={division.id}
              type="button"
              data-testid={`division-pill-${division.id}`}
              aria-pressed={isSelected}
              onClick={() => handleDivisionClick(division.id)}
              className={
                isSelected
                  ? 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-teal-700 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0F766E] transition-all duration-200 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                  : 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#E5E3DC] bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-all duration-200 ease-out hover:border-zinc-300 hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:min-h-[30px] dark:border-zinc-800 dark:bg-[#161B22] dark:text-slate-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
              }
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: division.color }}
              />
              <span>{division.shortName}</span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-700 font-mono-tabular dark:bg-zinc-800 dark:text-zinc-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
