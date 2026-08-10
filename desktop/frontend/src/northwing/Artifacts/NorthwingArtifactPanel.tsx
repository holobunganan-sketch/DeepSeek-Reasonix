import { CheckCircle2, ExternalLink, FolderSearch, Star } from "lucide-react";
import type { FilterableArtifact } from "./artifactFilters";

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
  const name = (artifact.path ?? "").replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? artifact.path;
  const time = artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : "";

  return (
    <article className={`nw-artifact-panel${isFinal ? " nw-artifact-panel--final" : ""}`} data-testid="artifact-panel">
      <div className="nw-artifact-panel__copy">
        <strong title={artifact.path}>{name}</strong>
        <span>
          {artifact.kind} · Version {artifact.version}{time ? ` · ${time}` : ""}
        </span>
        <span>
          Project: {artifact.projectName || artifact.projectId} · Work: {artifact.workId}
        </span>
      </div>
      <div className="nw-artifact-panel__badges">
        {isValidated && <span className="nw-artifact-panel__badge nw-artifact-panel__badge--validated">Validated</span>}
        {isFinal && (
          <span className="nw-artifact-panel__badge nw-artifact-panel__badge--final">
            <CheckCircle2 size={12} /> Final
          </span>
        )}
      </div>
      <div className="nw-artifact-panel__actions">
        {onPreview && (
          <button type="button" onClick={() => onPreview(artifact)}>
            Preview
          </button>
        )}
        {onOpen && (
          <button type="button" onClick={() => onOpen(artifact)}>
            <ExternalLink size={12} /> Open
          </button>
        )}
        {onReveal && (
          <button type="button" onClick={() => onReveal(artifact)}>
            <FolderSearch size={12} /> Reveal
          </button>
        )}
        {onMarkFinal && !isFinal && (
          <button type="button" onClick={() => onMarkFinal(artifact)}>
            <Star size={12} /> Set final
          </button>
        )}
        {onOpenWork && (
          <button type="button" onClick={() => onOpenWork(artifact)}>
            Open Work
          </button>
        )}
      </div>
    </article>
  );
}
