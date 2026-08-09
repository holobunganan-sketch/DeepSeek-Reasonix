import { useState } from "react";
import { FileText, ExternalLink, FolderOpen } from "lucide-react";
import type { CoworkArtifact } from "../../lib/northwingCowork";
import { previewCoworkArtifact, openCoworkArtifact } from "../../lib/northwingCowork";

type MaterialsTab = "materials" | "artifacts" | "versions";

export type NorthwingMaterialsPanelProps = {
  workspaceRoot: string;
  materials?: string[];
  artifacts: CoworkArtifact[];
  expectedArtifact?: string;
};

const kindLabels: Record<string, string> = {
  docx: "DOCX",
  pptx: "PPTX",
  xlsx: "XLSX",
  pdf: "PDF",
  file: "File",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function NorthwingMaterialsPanel({
  workspaceRoot,
  materials,
  artifacts,
  expectedArtifact,
}: NorthwingMaterialsPanelProps) {
  const [tab, setTab] = useState<MaterialsTab>("materials");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreview = async (artifact: CoworkArtifact) => {
    try {
      setPreviewError(null);
      const result = await previewCoworkArtifact(workspaceRoot, artifact.path);
      setPreview(result.body ?? "Preview not available");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpen = async (artifact: CoworkArtifact) => {
    await openCoworkArtifact(workspaceRoot, artifact.path);
  };

  return (
    <div className="nw-materials-panel">
      <nav className="nw-materials-panel__tabs" role="tablist" aria-label="Materials panel">
        {(["materials", "artifacts", "versions"] as MaterialsTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`nw-materials-panel__tab${tab === t ? " nw-materials-panel__tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "materials" && "Materials"}
            {t === "artifacts" && "Artifacts"}
            {t === "versions" && "Versions"}
          </button>
        ))}
      </nav>

      <div className="nw-materials-panel__content">
        {tab === "materials" && (
          <section aria-labelledby="nw-materials-heading">
            <h3 id="nw-materials-heading" className="nw-materials-panel__heading">
              Materials
            </h3>
            {materials && materials.length > 0 ? (
              <ul className="nw-materials-panel__list" role="list">
                {materials.map((path) => (
                  <li key={path} className="nw-materials-panel__file">
                    <FileText size={14} aria-hidden="true" />
                    <span className="nw-materials-panel__file-name">{path}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nw-materials-panel__empty">No materials specified.</p>
            )}
            {expectedArtifact && (
              <div className="nw-materials-panel__expected">
                <h3 className="nw-materials-panel__heading">Expected output</h3>
                <p className="nw-materials-panel__text">{expectedArtifact}</p>
              </div>
            )}
          </section>
        )}

        {tab === "artifacts" && (
          <section aria-labelledby="nw-artifacts-heading">
            <h3 id="nw-artifacts-heading" className="nw-materials-panel__heading">
              Artifacts
            </h3>
            {artifacts.length === 0 ? (
              <p className="nw-materials-panel__empty">No artifacts produced yet.</p>
            ) : (
              <ul className="nw-materials-panel__list" role="list">
                {artifacts.map((artifact) => {
                  const fileName = artifact.path.split("/").pop() ?? artifact.path;
                  return (
                    <li key={artifact.id} className="nw-materials-panel__file nw-materials-panel__artifact">
                      <FileText size={14} aria-hidden="true" />
                      <span className="nw-materials-panel__file-name">{fileName}</span>
                      <span className="nw-materials-panel__artifact-kind">
                        {kindLabels[artifact.kind] ?? artifact.kind.toUpperCase()}
                      </span>
                      <span className="nw-materials-panel__file-meta">v{artifact.version}</span>
                      <span className="nw-materials-panel__file-meta">{formatSize(artifact.size)}</span>
                      <div className="nw-materials-panel__actions">
                        <button
                          type="button"
                          className="nw-btn nw-btn--ghost"
                          aria-label={`Preview ${fileName}`}
                          onClick={() => handlePreview(artifact)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="nw-btn nw-btn--ghost"
                          aria-label={`Open ${fileName}`}
                          onClick={() => handleOpen(artifact)}
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {preview && (
              <div className="nw-materials-panel__preview">
                <pre className="nw-materials-panel__preview-text">{preview}</pre>
              </div>
            )}
            {previewError && (
              <p className="nw-materials-panel__error">{previewError}</p>
            )}
          </section>
        )}

        {tab === "versions" && (
          <section aria-labelledby="nw-versions-heading">
            <h3 id="nw-versions-heading" className="nw-materials-panel__heading">
              Versions
            </h3>
            {artifacts.length === 0 ? (
              <p className="nw-materials-panel__empty">No version history.</p>
            ) : (
              <ul className="nw-materials-panel__list" role="list">
                {artifacts
                  .sort((a, b) => b.version - a.version)
                  .map((artifact) => {
                    const fileName = artifact.path.split("/").pop() ?? artifact.path;
                    return (
                      <li key={artifact.id} className="nw-materials-panel__file">
                        <FolderOpen size={14} aria-hidden="true" />
                        <span className="nw-materials-panel__file-name">
                          {fileName} (v{artifact.version})
                        </span>
                        <time className="nw-materials-panel__file-meta" dateTime={artifact.createdAt}>
                          {formatTime(artifact.createdAt)}
                        </time>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
