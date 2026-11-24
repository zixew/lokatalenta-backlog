import { AlertCircle, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  BACKLOG_ITEM_TYPES,
  BACKLOG_MOSCOWS,
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  CANONICAL_DIVISIONS,
  getAgentsByDivision,
} from '../../../shared/contracts.ts';
import type {
  AcceptanceCriterion,
  BacklogItem,
  BacklogItemType,
  BacklogMoscow,
  BacklogPriority,
  BacklogStatus,
  CreateBacklogItemInput,
  DivisionId,
  UpdateBacklogItemInput,
} from '../../../shared/types.ts';
import { MOSCOW_LABELS, STATUS_META, TYPE_LABELS } from '../lib/presentation.ts';

interface ItemFormModalProps {
  editingItem: BacklogItem | null;
  allItems: BacklogItem[];
  onClose: () => void;
  onCreate: (input: CreateBacklogItemInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateBacklogItemInput) => Promise<void>;
}

export function ItemFormModal({
  editingItem,
  allItems,
  onClose,
  onCreate,
  onUpdate,
}: ItemFormModalProps) {
  const isEditing = editingItem !== null;

  const initialDivision: DivisionId = editingItem?.ownerDivision ?? 'engineering';
  const initialAgents = getAgentsByDivision(initialDivision);

  const [itemId, setItemId] = useState(editingItem?.id ?? '');
  const [type, setType] = useState<BacklogItemType>(editingItem?.type ?? 'story');
  const [title, setTitle] = useState(editingItem?.title ?? '');
  const [description, setDescription] = useState(editingItem?.description ?? '');
  const [status, setStatus] = useState<BacklogStatus>(editingItem?.status ?? 'raw');
  const [priority, setPriority] = useState<BacklogPriority>(editingItem?.priority ?? 'P1');
  const [moscow, setMoscow] = useState<BacklogMoscow>(editingItem?.moscow ?? 'should');
  const [storyPoints, setStoryPoints] = useState<number>(editingItem?.storyPoints ?? 3);
  const [sprintId, setSprintId] = useState(editingItem?.sprintId ?? '');
  const [ownerDivision, setOwnerDivision] = useState<DivisionId>(initialDivision);
  const [ownerAgentId, setOwnerAgentId] = useState<number>(
    editingItem?.ownerAgentId ?? initialAgents[0]?.id ?? 5,
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<AcceptanceCriterion[]>(
    editingItem?.acceptanceCriteria.map((ac) => ({ ...ac })) ?? [],
  );
  const [dependencies, setDependencies] = useState<string[]>(
    editingItem?.dependencies ? [...editingItem.dependencies] : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const divisionAgents = getAgentsByDivision(ownerDivision);
  const dependencyCandidates = allItems.filter((candidate) => candidate.id !== editingItem?.id);

  const handleDivisionChange = (nextDivision: DivisionId) => {
    setOwnerDivision(nextDivision);
    const validAgents = getAgentsByDivision(nextDivision);
    const stillValid = validAgents.some((agent) => agent.id === ownerAgentId);
    if (!stillValid && validAgents[0]) {
      setOwnerAgentId(validAgents[0].id);
    }
  };

  const handleAddCriterion = () => {
    setAcceptanceCriteria((prev) => [...prev, { given: '', when: '', then: '' }]);
  };

  const handleUpdateCriterion = (
    index: number,
    field: keyof AcceptanceCriterion,
    value: string,
  ) => {
    setAcceptanceCriteria((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    );
  };

  const handleRemoveCriterion = (index: number) => {
    setAcceptanceCriteria((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleDependency = (depId: string) => {
    setDependencies((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const normalizedSprint = sprintId.trim() === '' ? null : sprintId.trim();
      if (isEditing && editingItem) {
        await onUpdate(editingItem.id, {
          type,
          title,
          description,
          status,
          priority,
          moscow,
          storyPoints,
          sprintId: normalizedSprint,
          ownerDivision,
          ownerAgentId,
          acceptanceCriteria,
          dependencies,
        });
      } else {
        const trimmedId = itemId.trim();
        await onCreate({
          ...(trimmedId ? { id: trimmedId } : {}),
          type,
          title,
          description,
          status,
          priority,
          moscow,
          storyPoints,
          sprintId: normalizedSprint,
          ownerDivision,
          ownerAgentId,
          acceptanceCriteria,
          dependencies,
        });
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save backlog item';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-modal-title"
        data-testid="item-modal"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E5E3DC] bg-white dark:border-zinc-800 dark:bg-[#161B22]"
      >
        <div className="flex items-center justify-between border-b border-[#E5E3DC] px-5 py-4 dark:border-zinc-800">
          <div>
            <h2
              id="item-modal-title"
              className="text-base font-bold text-zinc-900 dark:text-slate-100"
            >
              {isEditing ? `Edit & Groom ${editingItem.id}` : 'Create Backlog Item'}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-slate-400">
              Assign canonical division &amp; agent ownership, Given-When-Then ACs, and DAG
              dependencies.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#E5E3DC] text-zinc-600 hover:bg-[#F6F5F1] dark:border-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 space-y-4 overflow-y-auto p-5">
          {errorMessage && (
            <div
              role="alert"
              data-testid="modal-error-banner"
              className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="input-item-id"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Item ID (optional)
              </label>
              <input
                id="input-item-id"
                data-testid="input-item-id"
                type="text"
                disabled={isEditing}
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder="Auto BL-XXX or ARC-001"
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm font-mono-tabular disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:disabled:bg-zinc-800"
              />
            </div>

            <div>
              <label
                htmlFor="select-item-type"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Type
              </label>
              <select
                id="select-item-type"
                data-testid="select-item-type"
                value={type}
                onChange={(e) => setType(e.target.value as BacklogItemType)}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {BACKLOG_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="select-item-status"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Status
              </label>
              <select
                id="select-item-status"
                data-testid="select-item-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BacklogStatus)}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {BACKLOG_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_META[st].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="input-item-title"
              className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
            >
              Title *
            </label>
            <input
              id="input-item-title"
              data-testid="input-item-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Concise, actionable backlog headline"
              className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="input-item-description"
              className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
            >
              Description
            </label>
            <textarea
              id="input-item-description"
              data-testid="input-item-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, architectural context, and integration notes"
              className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label
                htmlFor="select-item-priority"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Priority
              </label>
              <select
                id="select-item-priority"
                data-testid="select-item-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as BacklogPriority)}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {BACKLOG_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="select-item-moscow"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                MoSCoW
              </label>
              <select
                id="select-item-moscow"
                data-testid="select-item-moscow"
                value={moscow}
                onChange={(e) => setMoscow(e.target.value as BacklogMoscow)}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {BACKLOG_MOSCOWS.map((m) => (
                  <option key={m} value={m}>
                    {MOSCOW_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="input-item-sp"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Story Points
              </label>
              <input
                id="input-item-sp"
                data-testid="input-item-sp"
                type="number"
                min={0}
                max={100}
                step={1}
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number.parseInt(e.target.value || '0', 10))}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm font-mono-tabular dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div>
              <label
                htmlFor="input-item-sprint"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Sprint ID
              </label>
              <input
                id="input-item-sprint"
                data-testid="input-item-sprint"
                type="text"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                placeholder="e.g. SPR-01"
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm font-mono-tabular dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="select-owner-division"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Owner Division
              </label>
              <select
                id="select-owner-division"
                data-testid="select-owner-division"
                value={ownerDivision}
                onChange={(e) => handleDivisionChange(e.target.value as DivisionId)}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {CANONICAL_DIVISIONS.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="select-owner-agent"
                className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-slate-300"
              >
                Owner Agent
              </label>
              <select
                id="select-owner-agent"
                data-testid="select-owner-agent"
                value={ownerAgentId}
                onChange={(e) => setOwnerAgentId(Number.parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-[#E5E3DC] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {divisionAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    #{agent.id} {agent.name} — {agent.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            data-testid="ac-builder"
            className="space-y-2.5 rounded-lg border border-[#E5E3DC] bg-[#FAF9F6] p-3.5 dark:border-zinc-800 dark:bg-[#11161E]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-slate-300">
                Acceptance Criteria (Given / When / Then)
              </span>
              <button
                type="button"
                data-testid="add-ac-btn"
                onClick={handleAddCriterion}
                className="inline-flex items-center gap-1 rounded-md border border-[#E5E3DC] bg-white px-2.5 py-1 text-xs font-semibold text-[#0F766E] hover:bg-teal-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-teal-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Criterion</span>
              </button>
            </div>

            {acceptanceCriteria.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-slate-400">
                No acceptance criteria added yet. Click &ldquo;Add Criterion&rdquo; to define
                testable behavior.
              </p>
            ) : (
              <div className="space-y-2.5">
                {acceptanceCriteria.map((criterion, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 rounded-md border border-[#E5E3DC] bg-white p-2.5 sm:grid-cols-[1fr_1fr_1fr_auto] dark:border-zinc-800 dark:bg-[#161B22]"
                  >
                    <input
                      type="text"
                      data-testid={`ac-given-${index}`}
                      aria-label={`Criterion ${index + 1} Given`}
                      value={criterion.given}
                      onChange={(e) => handleUpdateCriterion(index, 'given', e.target.value)}
                      placeholder="Given..."
                      className="rounded border border-[#E5E3DC] px-2.5 py-1.5 text-xs dark:border-zinc-700"
                    />
                    <input
                      type="text"
                      data-testid={`ac-when-${index}`}
                      aria-label={`Criterion ${index + 1} When`}
                      value={criterion.when}
                      onChange={(e) => handleUpdateCriterion(index, 'when', e.target.value)}
                      placeholder="When..."
                      className="rounded border border-[#E5E3DC] px-2.5 py-1.5 text-xs dark:border-zinc-700"
                    />
                    <input
                      type="text"
                      data-testid={`ac-then-${index}`}
                      aria-label={`Criterion ${index + 1} Then`}
                      value={criterion.then}
                      onChange={(e) => handleUpdateCriterion(index, 'then', e.target.value)}
                      placeholder="Then..."
                      className="rounded border border-[#E5E3DC] px-2.5 py-1.5 text-xs dark:border-zinc-700"
                    />
                    <button
                      type="button"
                      data-testid={`ac-remove-${index}`}
                      aria-label={`Remove criterion ${index + 1}`}
                      onClick={() => handleRemoveCriterion(index)}
                      className="inline-flex items-center justify-center rounded border border-[#E5E3DC] px-2 py-1 text-rose-700 hover:bg-rose-50 dark:border-zinc-700 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            data-testid="dependency-picker"
            className="space-y-2 rounded-lg border border-[#E5E3DC] bg-[#FAF9F6] p-3.5 dark:border-zinc-800 dark:bg-[#11161E]"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-slate-300">
              Dependencies
            </div>

            {dependencies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dependencies.map((depId) => (
                  <button
                    key={depId}
                    type="button"
                    data-testid={`dep-chip-${depId}`}
                    onClick={() => handleToggleDependency(depId)}
                    className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-[#0F766E] font-mono-tabular dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                  >
                    <span>{depId}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            {dependencyCandidates.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-slate-400">
                No other backlog items available to link as dependencies.
              </p>
            ) : (
              <div className="grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {dependencyCandidates.map((candidate) => {
                  const selected = dependencies.includes(candidate.id);
                  return (
                    <label
                      key={candidate.id}
                      className={
                        selected
                          ? 'flex cursor-pointer items-center gap-2 rounded border border-teal-600 bg-teal-50/70 px-2.5 py-1.5 text-xs dark:border-teal-700 dark:bg-teal-950/40'
                          : 'flex cursor-pointer items-center gap-2 rounded border border-[#E5E3DC] bg-white px-2.5 py-1.5 text-xs hover:bg-[#F6F5F1] dark:border-zinc-800 dark:bg-[#161B22] dark:hover:bg-zinc-800'
                      }
                    >
                      <input
                        type="checkbox"
                        data-testid={`dep-option-${candidate.id}`}
                        checked={selected}
                        onChange={() => handleToggleDependency(candidate.id)}
                        className="accent-[#0F766E]"
                      />
                      <span className="font-bold font-mono-tabular">{candidate.id}</span>
                      <span className="truncate text-zinc-600 dark:text-slate-400">
                        {candidate.title}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E5E3DC] pt-4 dark:border-zinc-800">
            <button
              type="button"
              data-testid="modal-cancel-btn"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#E5E3DC] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-[#F6F5F1] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="modal-submit-btn"
              disabled={submitting}
              className="min-h-[40px] rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-out hover:bg-[#115E59] disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
