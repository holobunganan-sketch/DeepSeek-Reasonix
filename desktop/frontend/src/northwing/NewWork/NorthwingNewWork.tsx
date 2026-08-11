import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WorkKind, WorkQuality, SourcePolicy } from "../../lib/northwingWorkSpec";
import { WORK_KINDS, WORK_QUALITIES, SOURCE_POLICIES } from "../../lib/northwingWorkSpec";
import { useT } from "../../lib/i18n";
import "./NorthwingNewWork.css";

export type NewWorkFormState = {
  title?: string;
  objective: string;
  materials: string[];
  outputType: WorkKind;
  quality: WorkQuality;
  sourcePolicy: SourcePolicy;
  modelRef: string;
  audience: string;
  constraints: string;
  acceptanceCriteria: string[];
  pausePolicy: string;
  reasoningEffort: string;
};

const DEFAULT_FORM: NewWorkFormState = {
  title: "",
  objective: "",
  materials: [],
  outputType: "general",
  quality: "standard",
  sourcePolicy: "project_only",
  modelRef: "",
  audience: "",
  constraints: "",
  acceptanceCriteria: [],
  pausePolicy: "pause",
  reasoningEffort: "",
};

export type NorthwingNewWorkProps = {
  preselectedWorkspace?: string;
  workspaceOptions?: string[];
  requireProjectSelection?: boolean;
  initialForm?: Partial<Pick<NewWorkFormState, "title" | "objective">>;
  availableModels?: { id: string; name: string; current?: boolean }[];
  modelsLoading?: boolean;
  modelCatalogError?: string;
  availableEfforts?: string[];
  effortSupported?: boolean;
  onConfigureModels?: () => void;
  onLaunch: (workspaceRoot: string, form: NewWorkFormState) => Promise<void>;
  onCancel?: () => void;
};

export function NorthwingNewWork({
  preselectedWorkspace,
  workspaceOptions = [],
  requireProjectSelection = false,
  initialForm,
  availableModels = [],
  modelsLoading = false,
  modelCatalogError,
  availableEfforts = [],
  effortSupported = false,
  onConfigureModels,
  onLaunch,
  onCancel,
}: NorthwingNewWorkProps) {
  const t = useT();
  const [form, setForm] = useState<NewWorkFormState>(() => ({ ...DEFAULT_FORM, ...initialForm }));
  const [workspaceRoot, setWorkspaceRoot] = useState(preselectedWorkspace ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const update = useCallback(<K extends keyof NewWorkFormState>(key: K, value: NewWorkFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const root = workspaceRoot.trim();
    if (!root) {
      setError(t("northwing.newWork.selectProjectError"));
      return;
    }
    if (!form.objective.trim()) {
      setError(t("northwing.newWork.objectiveError"));
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await onLaunch(root, form);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }, [workspaceRoot, form, onLaunch, t]);

  return (
    <div className="nw-new-work" role="dialog" aria-label={t("northwing.nav.newWork")} data-northwing-page="new-work">
      <div className="nw-new-work__card">
        <h2 className="nw-new-work__title">{t("northwing.nav.newWork")}</h2>
        <p className="nw-new-work__subtitle">{t("northwing.newWork.subtitle")}</p>

        {/* Project / folder */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.projectFolder")}</span>
          {requireProjectSelection ? (
            <select
              className="nw-input"
              value={workspaceRoot}
              onChange={(e) => setWorkspaceRoot(e.target.value)}
              aria-label={t("northwing.newWork.projectWorkspace")}
            >
              <option value="">{t("northwing.newWork.selectWorkspace")}</option>
              {workspaceOptions.map((workspace) => <option key={workspace} value={workspace}>{workspace}</option>)}
            </select>
          ) : (
            <input
              type="text"
              className="nw-input"
              placeholder={preselectedWorkspace || t("northwing.newWork.projectPlaceholder")}
              value={workspaceRoot}
              onChange={(e) => setWorkspaceRoot(e.target.value)}
              disabled={!!preselectedWorkspace}
              aria-label={t("northwing.newWork.projectFolder")}
            />
          )}
        </label>

        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.title")}</span>
          <input
            type="text"
            className="nw-input"
            value={form.title ?? ""}
            onChange={(e) => update("title", e.target.value)}
            aria-label={t("northwing.newWork.title")}
          />
        </label>

        {/* Objective */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.objective")}</span>
          <textarea
            className="nw-input nw-input--textarea"
            rows={3}
            placeholder={t("northwing.newWork.objectivePlaceholder")}
            value={form.objective}
            onChange={(e) => update("objective", e.target.value)}
            aria-label={t("northwing.newWork.objectiveAria")}
            autoFocus
          />
        </label>

        {/* Materials */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.materials")}</span>
          <textarea
            className="nw-input nw-input--textarea"
            rows={2}
            placeholder={t("northwing.newWork.materialsPlaceholder")}
            value={form.materials.join("\n")}
            onChange={(e) => update("materials", e.target.value.split("\n").filter(Boolean))}
            aria-label={t("northwing.newWork.materials")}
          />
        </label>

        {/* Output type */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.outputType")}</span>
          <select
            className="nw-input"
            value={form.outputType}
            onChange={(e) => update("outputType", e.target.value as WorkKind)}
            aria-label={t("northwing.newWork.outputType")}
          >
            {WORK_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        {/* Quality */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.quality")}</span>
          <select
            className="nw-input"
            value={form.quality}
            onChange={(e) => update("quality", e.target.value as WorkQuality)}
            aria-label={t("northwing.newWork.quality")}
          >
            {WORK_QUALITIES.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>

        {/* Source policy */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">{t("northwing.newWork.sourcePolicy")}</span>
          <select
            className="nw-input"
            value={form.sourcePolicy}
            onChange={(e) => update("sourcePolicy", e.target.value as SourcePolicy)}
            aria-label={t("northwing.newWork.sourcePolicy")}
          >
            {SOURCE_POLICIES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>

        {/* Model */}
        {modelsLoading ? (
          <p className="nw-new-work__model-state" role="status">{t("northwing.newWork.modelsLoading")}</p>
        ) : availableModels.length > 0 ? (
          <label className="nw-new-work__field">
            <span className="nw-new-work__label">{t("northwing.newWork.model")}</span>
            <select
              className="nw-input"
              value={form.modelRef}
              onChange={(e) => update("modelRef", e.target.value)}
              aria-label={t("northwing.newWork.model")}
            >
              <option value="">
                {t("northwing.newWork.default")}: {availableModels.find((model) => model.current)?.name ?? availableModels[0].name}
              </option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="nw-new-work__model-state" role="alert">
            <strong>{t("northwing.newWork.noModel")}</strong>
            <span>{modelCatalogError || t("northwing.newWork.noModelBody")}</span>
            {onConfigureModels && (
              <button type="button" className="nw-btn nw-btn--ghost" onClick={onConfigureModels}>
                {t("northwing.newWork.configureModels")}
              </button>
            )}
          </div>
        )}

        {/* Advanced toggle */}
        <button
          type="button"
          className="nw-new-work__advanced-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span>{t("northwing.newWork.advanced")}</span>
        </button>

        {showAdvanced && (
          <div className="nw-new-work__advanced">
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">{t("northwing.newWork.audience")}</span>
              <input
                type="text"
                className="nw-input"
                placeholder={t("northwing.newWork.audiencePlaceholder")}
                value={form.audience}
                onChange={(e) => update("audience", e.target.value)}
              />
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">{t("northwing.newWork.constraints")}</span>
              <textarea
                className="nw-input nw-input--textarea"
                rows={2}
                placeholder={t("northwing.newWork.constraintsPlaceholder")}
                value={form.constraints}
                onChange={(e) => update("constraints", e.target.value)}
              />
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">{t("northwing.newWork.acceptance")}</span>
              <textarea
                className="nw-input nw-input--textarea"
                rows={2}
                placeholder={t("northwing.newWork.acceptancePlaceholder")}
                value={form.acceptanceCriteria.join("\n")}
                onChange={(e) => update("acceptanceCriteria", e.target.value.split("\n").filter(Boolean))}
              />
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">{t("northwing.newWork.pausePolicy")}</span>
              <select
                className="nw-input"
                value={form.pausePolicy}
                onChange={(e) => update("pausePolicy", e.target.value)}
              >
                <option value="pause">{t("northwing.newWork.pauseQuestions")}</option>
                <option value="continue">{t("northwing.newWork.continue")}</option>
                <option value="ask_every">{t("northwing.newWork.askEvery")}</option>
              </select>
            </label>
            {effortSupported && availableEfforts.length > 0 ? (
              <label className="nw-new-work__field">
                <span className="nw-new-work__label">{t("northwing.newWork.reasoningEffort")}</span>
                <select
                  className="nw-input"
                  value={form.reasoningEffort}
                  onChange={(e) => update("reasoningEffort", e.target.value)}
                  aria-label={t("northwing.newWork.reasoningEffort")}
                >
                  <option value="">{t("northwing.newWork.default")}</option>
                  {availableEfforts.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="nw-new-work__model-state">{t("northwing.newWork.noEffort")}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p className="nw-new-work__error" role="alert">{error}</p>}

        {/* Actions */}
        <div className="nw-new-work__actions">
          <button type="button" className="nw-btn nw-btn--ghost" onClick={onCancel} disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="nw-btn nw-btn--primary"
            onClick={handleSubmit}
            disabled={submitting || modelsLoading || availableModels.length === 0}
          >
            {submitting ? t("northwing.newWork.creating") : t("northwing.newWork.start")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NorthwingNewWork;
