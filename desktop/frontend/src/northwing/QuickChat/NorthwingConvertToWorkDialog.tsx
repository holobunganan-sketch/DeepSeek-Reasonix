import { useState } from "react";
import { useT } from "../../lib/i18n";
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
  const t = useT();
  const [objective, setObjective] = useState("");

  const handleSubmit = () => {
    const trimmed = objective.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="nw-convert-dialog__overlay" role="dialog" aria-label={t("northwing.quickChat.convert")} onClick={onCancel}>
      <div className="nw-convert-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="nw-convert-dialog__title">{t("northwing.quickChat.convert")}</h3>
        <p className="nw-convert-dialog__desc">
          {t("northwing.quickChat.convertDescription")}
        </p>
        <label className="nw-convert-dialog__field">
          <span className="nw-convert-dialog__label">{t("northwing.newWork.objective")}</span>
          <textarea
            className="nw-input nw-input--textarea"
            rows={3}
            placeholder={t("northwing.quickChat.convertObjective")}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            autoFocus
            disabled={submitting}
          />
        </label>
        {error && <p className="nw-convert-dialog__error" role="alert">{error}</p>}
        <div className="nw-convert-dialog__actions">
          <button type="button" className="nw-btn nw-btn--ghost" onClick={onCancel} disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="nw-btn nw-btn--primary"
            onClick={handleSubmit}
            disabled={submitting || !objective.trim()}
          >
            {submitting ? t("northwing.quickChat.converting") : t("northwing.quickChat.createWork")}
          </button>
        </div>
      </div>
    </div>
  );
}
