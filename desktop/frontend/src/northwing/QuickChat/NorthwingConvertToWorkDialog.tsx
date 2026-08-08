import { useState } from "react";
import "./NorthwingQuickChat.css";

export type NorthwingConvertToWorkDialogProps = {
  submitting: boolean;
  error?: string;
  onConfirm: (objective: string) => void;
  onCancel: () => void;
};

export function NorthwingConvertToWorkDialog({
  submitting,
  error,
  onConfirm,
  onCancel,
}: NorthwingConvertToWorkDialogProps) {
  const [objective, setObjective] = useState("");

  const handleSubmit = () => {
    const trimmed = objective.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="nw-convert-dialog__overlay" role="dialog" aria-label="Convert to Work" onClick={onCancel}>
      <div className="nw-convert-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="nw-convert-dialog__title">Convert to Work</h3>
        <p className="nw-convert-dialog__desc">
          This preserves your chat history and creates a formal Work with acceptance, artifacts, and review stages.
        </p>
        <label className="nw-convert-dialog__field">
          <span className="nw-convert-dialog__label">What do you want to finish?</span>
          <textarea
            className="nw-input nw-input--textarea"
            rows={3}
            placeholder="Describe the goal this conversation should work toward..."
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            autoFocus
            disabled={submitting}
          />
        </label>
        {error && <p className="nw-convert-dialog__error" role="alert">{error}</p>}
        <div className="nw-convert-dialog__actions">
          <button type="button" className="nw-btn nw-btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="nw-btn nw-btn--primary"
            onClick={handleSubmit}
            disabled={submitting || !objective.trim()}
          >
            {submitting ? "Converting..." : "Create Work"}
          </button>
        </div>
      </div>
    </div>
  );
}
