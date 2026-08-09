import { Suspense, lazy } from "react";
import { X } from "lucide-react";

const LazyPreviewContent = lazy(() =>
  import("./NorthwingArtifactPreviewContent").then((mod) => ({
    default: mod.NorthwingArtifactPreviewContent,
  })),
);

export type NorthwingArtifactPreviewProps = {
  artifact: {
    id: string;
    path: string;
    kind: string;
    version: number;
  };
  workspaceRoot: string;
  onClose: () => void;
};

export function NorthwingArtifactPreview({
  artifact,
  workspaceRoot,
  onClose,
}: NorthwingArtifactPreviewProps) {
  return (
    <aside className="nw-artifact-preview" aria-label="Artifact preview">
      <header className="nw-artifact-preview__header">
        <strong>{basename(artifact.path)}</strong>
        <button type="button" onClick={onClose} aria-label="Close preview">
          <X size={14} />
        </button>
      </header>
      <Suspense fallback={<div className="nw-artifact-preview__loading">Loading preview...</div>}>
        <LazyPreviewContent artifact={artifact} workspaceRoot={workspaceRoot} />
      </Suspense>
    </aside>
  );
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}
