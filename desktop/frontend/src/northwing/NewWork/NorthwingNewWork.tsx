import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WorkKind, WorkQuality, SourcePolicy } from "../../lib/northwingWorkSpec";
import { WORK_KINDS, WORK_QUALITIES, SOURCE_POLICIES } from "../../lib/northwingWorkSpec";
import type { NorthwingDestination } from "../Navigation/routes";
import "./NorthwingNewWork.css";

export type NewWorkFormState = {
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
  availableModels?: { id: string; name: string }[];
  onLaunch: (workspaceRoot: string, form: NewWorkFormState) => Promise<void>;
  onCancel?: () => void;
};

export function NorthwingNewWork({
  preselectedWorkspace,
  availableModels = [],
  onLaunch,
  onCancel,
}: NorthwingNewWorkProps) {
  const [form, setForm] = useState<NewWorkFormState>({ ...DEFAULT_FORM });
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
      setError("Select a project folder.");
      return;
    }
    if (!form.objective.trim()) {
      setError("Describe what you want to finish.");
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
  }, [workspaceRoot, form, onLaunch]);

  return (
    <div className="nw-new-work" role="dialog" aria-label="New Work" data-northwing-page="new-work">
      <div className="nw-new-work__card">
        <h2 className="nw-new-work__title">New Work</h2>
        <p className="nw-new-work__subtitle">From intent to finished work</p>

        {/* Project / folder */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">Project folder</span>
          <input
            type="text"
            className="nw-input"
            placeholder={preselectedWorkspace || "Select or enter a project folder..."}
            value={workspaceRoot}
            onChange={(e) => setWorkspaceRoot(e.target.value)}
            disabled={!!preselectedWorkspace}
            aria-label="Project folder"
          />
        </label>

        {/* Objective */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">What do you want to finish?</span>
          <textarea
            className="nw-input nw-input--textarea"
            rows={3}
            placeholder="Describe your goal, deliverable, or outcome..."
            value={form.objective}
            onChange={(e) => update("objective", e.target.value)}
            aria-label="Work objective"
            autoFocus
          />
        </label>

        {/* Materials */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">Materials (one per line)</span>
          <textarea
            className="nw-input nw-input--textarea"
            rows={2}
            placeholder="Optional: reference files, URLs, or context..."
            value={form.materials.join("\n")}
            onChange={(e) => update("materials", e.target.value.split("\n").filter(Boolean))}
            aria-label="Materials"
          />
        </label>

        {/* Output type */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">Output type</span>
          <select
            className="nw-input"
            value={form.outputType}
            onChange={(e) => update("outputType", e.target.value as WorkKind)}
            aria-label="Output type"
          >
            {WORK_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        {/* Quality */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">Quality</span>
          <select
            className="nw-input"
            value={form.quality}
            onChange={(e) => update("quality", e.target.value as WorkQuality)}
            aria-label="Quality"
          >
            {WORK_QUALITIES.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>

        {/* Source policy */}
        <label className="nw-new-work__field">
          <span className="nw-new-work__label">Source policy</span>
          <select
            className="nw-input"
            value={form.sourcePolicy}
            onChange={(e) => update("sourcePolicy", e.target.value as SourcePolicy)}
            aria-label="Source policy"
          >
            {SOURCE_POLICIES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>

        {/* Model */}
        {availableModels.length > 0 && (
          <label className="nw-new-work__field">
            <span className="nw-new-work__label">Model</span>
            <select
              className="nw-input"
              value={form.modelRef}
              onChange={(e) => update("modelRef", e.target.value)}
              aria-label="Model"
            >
              <option value="">Default</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* Advanced toggle */}
        <button
          type="button"
          className="nw-new-work__advanced-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span>Advanced</span>
        </button>

        {showAdvanced && (
          <div className="nw-new-work__advanced">
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">Audience</span>
              <input
                type="text"
                className="nw-input"
                placeholder="Who will use this output?"
                value={form.audience}
                onChange={(e) => update("audience", e.target.value)}
              />
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">Constraints</span>
              <textarea
                className="nw-input nw-input--textarea"
                rows={2}
                placeholder="Limits, requirements, or rules..."
                value={form.constraints}
                onChange={(e) => update("constraints", e.target.value)}
              />
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">Acceptance criteria (one per line)</span>
              <textarea
                className="nw-input nw-input--textarea"
                rows={2}
                placeholder="How will you know it is done?"
                value={form.acceptanceCriteria.join("\n")}
                onChange={(e) => update("acceptanceCriteria", e.target.value.split("\n").filter(Boolean))}
              />
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">Pause policy</span>
              <select
                className="nw-input"
                value={form.pausePolicy}
                onChange={(e) => update("pausePolicy", e.target.value)}
              >
                <option value="pause">Pause on questions</option>
                <option value="continue">Continue when possible</option>
                <option value="ask_every">Ask every step</option>
              </select>
            </label>
            <label className="nw-new-work__field">
              <span className="nw-new-work__label">Reasoning effort</span>
              <select
                className="nw-input"
                value={form.reasoningEffort}
                onChange={(e) => update("reasoningEffort", e.target.value)}
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        )}

        {/* Error */}
        {error && <p className="nw-new-work__error" role="alert">{error}</p>}

        {/* Actions */}
        <div className="nw-new-work__actions">
          <button type="button" className="nw-btn nw-btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="nw-btn nw-btn--primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Start Work"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NorthwingNewWork;
