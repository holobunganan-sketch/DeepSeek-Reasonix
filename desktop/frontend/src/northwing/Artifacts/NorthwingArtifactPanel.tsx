import { CheckCircle2, ExternalLink, FolderSearch, Star } from "lucide-react";
import type { FilterableArtifact } from "./artifactFilters";
import { useT } from "../../lib/i18n";

export type NorthwingArtifactPanelProps = {
  artifact: FilterableArtifact;
  isFinal?: boolean;
  isValidated?: boolean;
  onPreview?: (artifact: FilterableArtifact) => void;
  onOpen?: (artifact: FilterableArtifact) => void;
  onReveal?: (artifact: FilterableArtifact) => void;
  onMarkFinal?: (artifact: FilterableArtifact) => void;
  onOpenWork?: (artifact: FilterableArtifact) => void;
};

export function NorthwingArtifactPanel({
  artifact,
  isFinal = false,
  isValidated = false,
  onPreview,
  onOpen,
  onReveal,
  onMarkFinal,
  onOpenWork,
}: NorthwingArtifactPanelProps) {
  const t = useT();
  const name = (artifact.path ?? "").replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? artifact.path;
  const time = artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : "";

  return (
    <article className={`nw-artifact-panel${isFinal ? " nw-artifact-panel--final" : ""}`} data-testid="artifact-panel">
      <div className="nw-artifact-panel__copy">
        <strong title={artifact.path}>{name}</strong>
        <span>
          {artifact.kind} · {t("northwing.artifacts.version", { version: artifact.version })}{time ? ` · ${time}` : ""}
        </span>
        <span>
          {t("northwing.artifacts.ownership", { project: artifact.projectName || artifact.projectId, work: artifact.workId })}
        </span>
      </div>
      <div className="nw-artifact-panel__badges">
        {isValidated && <span className="nw-artifact-panel__badge nw-artifact-panel__badge--validated">{t("northwing.artifacts.validated")}</span>}
        {isFinal && (
          <span className="nw-artifact-panel__badge nw-artifact-panel__badge--final">
            <CheckCircle2 size={12} /> {t("northwing.project.final")}
          </span>
        )}
      </div>
      <div className="nw-artifact-panel__actions">
        {onPreview && (
          <button type="button" onClick={() => onPreview(artifact)}>
            {t("northwing.artifacts.preview")}
          </button>
        )}
        {onOpen && (
          <button type="button" onClick={() => onOpen(artifact)}>
            <ExternalLink size={12} /> {t("northwing.artifacts.open")}
          </button>
        )}
        {onReveal && (
          <button type="button" onClick={() => onReveal(artifact)}>
            <FolderSearch size={12} /> {t("northwing.artifacts.reveal")}
          </button>
        )}
        {onMarkFinal && !isFinal && (
          <button type="button" onClick={() => onMarkFinal(artifact)}>
            <Star size={12} /> {t("northwing.artifacts.setFinal")}
          </button>
        )}
        {onOpenWork && (
          <button type="button" onClick={() => onOpenWork(artifact)}>
            {t("northwing.artifacts.openWork")}
          </button>
        )}
      </div>
    </article>
  );
}
