import { useMemo } from 'react';
import { CANONICAL_DIVISIONS } from '../../../shared/contracts.ts';
import type { BacklogItem, BacklogStats, DivisionId } from '../../../shared/types.ts';

interface StatsBarProps {
  stats: BacklogStats;
  activeDivision: string;
  onSelectDivision: (divisionId: string) => void;
  allItems?: BacklogItem[];
}

export function StatsBar({
  stats,
  activeDivision,
  onSelectDivision,
  allItems = [],
}: StatsBarProps) {
  const readyAndGroomed = stats.byStatus.groomed + stats.byStatus.ready;
  const inSprintOrDone = stats.byStatus.in_sprint + stats.byStatus.done;

  const spSummaryByDivision = useMemo(() => {
    const map = new Map<DivisionId, { totalSp: number; doneSp: number; readySp: number }>();
    for (const item of allItems) {
      const current = map.get(item.ownerDivision) ?? { totalSp: 0, doneSp: 0, readySp: 0 };
      current.totalSp += item.storyPoints;
      if (item.status === 'done') current.doneSp += item.storyPoints;
      if (item.status === 'ready') current.readySp += item.storyPoints;
      map.set(item.ownerDivision, current);
    }
    return map;
  }, [allItems]);

  const moscowSp = useMemo(() => {
    let must = 0;
    let should = 0;
    let could = 0;
    let wont = 0;
    for (const item of allItems) {
      if (item.moscow === 'must') must += item.storyPoints;
      else if (item.moscow === 'should') should += item.storyPoints;
      else if (item.moscow === 'could') could += item.storyPoints;
      else wont += item.storyPoints;
    }
    const total = must + should + could + wont;
    return { must, should, could, wont, total };
  }, [allItems]);

  const activeDivisionMeta =
    activeDivision !== 'all'
      ? CANONICAL_DIVISIONS.find((d) => d.id === activeDivision)
      : undefined;
  const activeDivisionSp =
    activeDivision !== 'all'
      ? spSummaryByDivision.get(activeDivision as DivisionId)
      : undefined;

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

      <div
        data-testid="moscow-sp-distribution"
        className="rounded-lg border border-[#E5E3DC] bg-white px-4 py-3 dark:border-zinc-800 dark:bg-[#161B22]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-slate-400">
            MoSCoW SP Distribution
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-700 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#0F766E] dark:bg-teal-500" />
              <span>Must:</span>
              <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-slate-100">
                {moscowSp.must} SP
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Should:</span>
              <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-slate-100">
                {moscowSp.should} SP
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sky-500" />
              <span>Could:</span>
              <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-slate-100">
                {moscowSp.could} SP
              </span>
            </span>
            {moscowSp.wont > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                <span>Won&apos;t:</span>
                <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-slate-100">
                  {moscowSp.wont} SP
                </span>
              </span>
            )}
          </div>
        </div>

        <div
          role="img"
          aria-label={`MoSCoW story points: Must ${moscowSp.must} SP, Should ${moscowSp.should} SP, Could ${moscowSp.could} SP${moscowSp.wont > 0 ? `, Won't ${moscowSp.wont} SP` : ''}`}
          className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          {moscowSp.total > 0 && (
            <>
              {moscowSp.must > 0 && (
                <div
                  title={`Must: ${moscowSp.must} SP`}
                  className="h-full bg-[#0F766E] transition-all duration-300 dark:bg-teal-500"
                  style={{ width: `${(moscowSp.must / moscowSp.total) * 100}%` }}
                />
              )}
              {moscowSp.should > 0 && (
                <div
                  title={`Should: ${moscowSp.should} SP`}
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${(moscowSp.should / moscowSp.total) * 100}%` }}
                />
              )}
              {moscowSp.could > 0 && (
                <div
                  title={`Could: ${moscowSp.could} SP`}
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${(moscowSp.could / moscowSp.total) * 100}%` }}
                />
              )}
              {moscowSp.wont > 0 && (
                <div
                  title={`Won't: ${moscowSp.wont} SP`}
                  className="h-full bg-zinc-400 transition-all duration-300 dark:bg-zinc-600"
                  style={{ width: `${(moscowSp.wont / moscowSp.total) * 100}%` }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CANONICAL_DIVISIONS.map((division) => {
          const isSelected = activeDivision === division.id;
          const count = stats.byDivision[division.id] ?? 0;
          const divSp = spSummaryByDivision.get(division.id)?.totalSp ?? 0;
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
                {allItems.length > 0 ? ` · ${divSp} SP` : ''}
              </span>
            </button>
          );
        })}

        {activeDivisionMeta && activeDivisionSp ? (
          <div
            data-testid="active-division-sp-summary"
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#0F766E]/30 bg-teal-50/70 px-3 py-1 text-xs text-[#0F766E] dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
          >
            <span className="font-semibold">{activeDivisionMeta.shortName}:</span>
            <span className="font-mono-tabular">
              {activeDivisionSp.totalSp} SP total · {activeDivisionSp.readySp} ready ·{' '}
              {activeDivisionSp.doneSp} done
            </span>
            <button
              type="button"
              onClick={() => onSelectDivision('all')}
              className="ml-1 rounded px-1 text-[11px] font-semibold underline hover:no-underline"
            >
              All
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
