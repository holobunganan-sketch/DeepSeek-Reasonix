import { Suspense, lazy } from "react";
import { X } from "lucide-react";
import { useT } from "../../lib/i18n";

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
  const t = useT();
  return (
    <aside className="nw-artifact-preview" aria-label={t("northwing.artifacts.previewLabel")}>
      <header className="nw-artifact-preview__header">
        <strong>{basename(artifact.path)}</strong>
        <button type="button" onClick={onClose} aria-label={t("northwing.artifacts.closePreview")}>
          <X size={14} />
        </button>
      </header>
      <Suspense fallback={<div className="nw-artifact-preview__loading">{t("northwing.artifacts.loadingPreview")}</div>}>
        <LazyPreviewContent artifact={artifact} workspaceRoot={workspaceRoot} />
      </Suspense>
    </aside>
  );
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}
