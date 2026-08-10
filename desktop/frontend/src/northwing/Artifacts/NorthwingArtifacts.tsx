import "./NorthwingArtifacts.css";
import { useCallback, useContext, useMemo, useState } from "react";
import { FileOutput, X } from "lucide-react";
import type { FilePreview } from "../../lib/types";
import {
  filterArtifacts,
  sortArtifactsByTime,
  type ArtifactFilterCriteria,
  type FilterableArtifact,
} from "./artifactFilters";
import { NorthwingArtifactPanel } from "./NorthwingArtifactPanel";

import { NorthwingNavigateContext } from "../Shell/NorthwingShell";
import type { NorthwingDestination } from "../Navigation/routes";

export type NorthwingArtifactsProps = {
  artifacts: FilterableArtifact[];
  loading?: boolean;
  error?: string;
  onPreview?: (artifact: FilterableArtifact) => FilePreview | void | Promise<FilePreview | void>;
  onOpen?: (artifact: FilterableArtifact) => void | Promise<void>;
  onReveal?: (artifact: FilterableArtifact) => void | Promise<void>;
  onMarkFinal?: (artifact: FilterableArtifact) => void | Promise<void>;
};

const KIND_CATEGORIES = ["", "docx", "pptx", "xlsx", "pdf", "txt", "md", "json", "csv", "other"];

export function NorthwingArtifacts({
  artifacts,
  loading = false,
  error,
  onPreview,
  onOpen,
  onReveal,
  onMarkFinal,
}: NorthwingArtifactsProps) {
  const navigate = useContext(NorthwingNavigateContext);
  const [criteria, setCriteria] = useState<ArtifactFilterCriteria>({});
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | undefined>();
  const [previewArtifact, setPreviewArtifact] = useState<FilterableArtifact | undefined>();
  const [preview, setPreview] = useState<FilePreview | undefined>();
  const [previewLoading, setPreviewLoading] = useState(false);

  const updateKind = useCallback((kind: string) => {
    setCriteria((prev) => ({ ...prev, kind: prev.kind === kind ? undefined : kind }));
  }, []);

  const toggleFinal = useCallback(() => {
    setCriteria((prev) => ({ ...prev, finalOnly: !prev.finalOnly }));
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setCriteria((prev) => ({ ...prev, search: value }));
  }, []);

  const handleOpenWork = useCallback(
    (artifact: FilterableArtifact) => {
      const dest: NorthwingDestination = {
        kind: "work",
        workspaceRoot: artifact.workspace,
        workId: artifact.workId,
      };
      navigate(dest);
    },
    [navigate],
  );

  const handlePreview = useCallback(async (artifact: FilterableArtifact) => {
    if (!onPreview) return;
    setActionError(undefined);
    setPreviewArtifact(artifact);
    setPreview(undefined);
    setPreviewLoading(true);
    try {
      const result = await onPreview(artifact);
      if (result) setPreview(result);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [onPreview]);

  const runAction = useCallback(async (
    action: ((artifact: FilterableArtifact) => void | Promise<void>) | undefined,
    artifact: FilterableArtifact,
  ) => {
    if (!action) return;
    setActionError(undefined);
    try {
      await action(artifact);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const filtered = useMemo(() => {
    const result = filterArtifacts(artifacts, criteria);
    return sortArtifactsByTime(result, "newest");
  }, [artifacts, criteria]);

  if (loading) {
    return (
      <main role="main" data-northwing-page="artifacts" className="nw-page">
        <h1 className="nw-page__title">Artifacts</h1>
        <p className="nw-page__subtitle">Loading artifacts...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main role="main" data-northwing-page="artifacts" className="nw-page">
        <h1 className="nw-page__title">Artifacts unavailable</h1>
        <p className="nw-page__subtitle">{error}</p>
      </main>
    );
  }

  return (
    <main role="main" data-northwing-page="artifacts" className="nw-artifacts-page">
      <div className="nw-artifacts-page__header">
        <h1 className="nw-artifacts-page__title">Artifacts</h1>
        <p className="nw-artifacts-page__subtitle">
          <FileOutput size={14} /> {filtered.length} of {artifacts.length} artifacts
        </p>
      </div>
      <div className="nw-artifacts-page__filters">
        {KIND_CATEGORIES.map((kind) => {
          const label = kind === "" ? "All" : kind === "other" ? "Other" : `.${kind}`;
          return (
            <button
              key={kind}
              type="button"
              className={`nw-artifacts-filter${criteria.kind === kind ? " nw-artifacts-filter--active" : ""}`}
              onClick={() => updateKind(kind)}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          className={`nw-artifacts-filter${criteria.finalOnly ? " nw-artifacts-filter--active" : ""}`}
          onClick={toggleFinal}
        >
          Final only
        </button>
        <input
          className="nw-artifacts-page__search"
          type="search"
          placeholder="Search artifacts..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          aria-label="Search artifacts"
        />
      </div>
      {actionError && <p className="nw-artifacts-page__error" role="alert">{actionError}</p>}
      <div className="nw-artifacts-page__list">
        {filtered.length === 0 ? (
          <p className="nw-artifacts-page__empty">
            {artifacts.length === 0
              ? "No artifacts yet. Artifacts appear here after a Work produces files."
              : "No artifacts match the current filters."}
          </p>
        ) : (
          filtered.map((artifact) => (
            <NorthwingArtifactPanel
              key={artifact.id}
              artifact={artifact}
              isFinal={artifact.final}
              onPreview={onPreview ? (selected) => void handlePreview(selected) : undefined}
              onOpen={onOpen ? (selected) => void runAction(onOpen, selected) : undefined}
              onReveal={onReveal ? (selected) => void runAction(onReveal, selected) : undefined}
              onMarkFinal={onMarkFinal ? (selected) => void runAction(onMarkFinal, selected) : undefined}
              onOpenWork={handleOpenWork}
            />
          ))
        )}
      </div>
      {previewArtifact && (
        <aside className="nw-artifact-preview" aria-label="Artifact preview">
          <header className="nw-artifact-preview__header">
            <strong>{previewArtifact.path.replace(/\\/g, "/").split("/").filter(Boolean).pop()}</strong>
            <button type="button" onClick={() => setPreviewArtifact(undefined)} aria-label="Close preview">
              <X size={14} />
            </button>
          </header>
          {previewLoading && <div className="nw-artifact-preview__loading">Loading preview...</div>}
          {!previewLoading && preview?.kind === "image" && preview.url && (
            <img className="nw-artifact-preview__image" src={preview.url} alt={previewArtifact.path} />
          )}
          {!previewLoading && preview?.kind === "pdf" && preview.url && (
            <iframe className="nw-artifact-preview__pdf" src={preview.url} title={previewArtifact.path} />
          )}
          {!previewLoading && preview && !preview.binary && !preview.url && (
            <pre className="nw-artifact-preview__text">{preview.body}</pre>
          )}
          {!previewLoading && preview?.binary && (
            <div className="nw-artifact-preview__binary">This file does not support embedded preview.</div>
          )}
        </aside>
      )}
    </main>
  );
}
