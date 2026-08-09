import "./NorthwingArtifacts.css";
import { useCallback, useContext, useMemo, useState } from "react";
import { FileOutput } from "lucide-react";
import {
  filterArtifacts,
  sortArtifactsByTime,
  type ArtifactFilterCriteria,
  type FilterableArtifact,
} from "./artifactFilters";

import { NorthwingNavigateContext } from "../Shell/NorthwingShell";
import type { NorthwingDestination } from "../Navigation/routes";

export type NorthwingArtifactsProps = {
  artifacts: FilterableArtifact[];
  loading?: boolean;
  error?: string;
  onPreview?: (artifact: FilterableArtifact) => void;
  onOpen?: (artifact: FilterableArtifact) => void;
  onReveal?: (artifact: FilterableArtifact) => void;
  onMarkFinal?: (artifact: FilterableArtifact) => void;
};

const KIND_CATEGORIES = ["", "docx", "pptx", "xlsx", "pdf", "txt", "md", "json", "csv", "other"];

export function NorthwingArtifacts({
  artifacts,
  loading = false,
  error,




}: NorthwingArtifactsProps) {
  const navigate = useContext(NorthwingNavigateContext);
  const [criteria, setCriteria] = useState<ArtifactFilterCriteria>({});
  const [search, setSearch] = useState("");

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

  const handleArtifactClick = useCallback(
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
        />
      </div>
      <div className="nw-artifacts-page__list">
        {filtered.length === 0 ? (
          <p className="nw-artifacts-page__empty">
            {artifacts.length === 0
              ? "No artifacts yet. Artifacts appear here after a Work produces files."
              : "No artifacts match the current filters."}
          </p>
        ) : (
          filtered.map((artifact) => (
            <div
              key={artifact.id}
              className="nw-artifact-row"
              onClick={() => handleArtifactClick(artifact)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleArtifactClick(artifact);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Open ${artifact.path}`}
            >
              <div className="nw-artifact-row__copy">
                <strong>
                  {artifact.path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? artifact.path}
                </strong>
                <span>
                  {artifact.kind} · Version {artifact.version} ·{" "}
                  {artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : ""}
                </span>
              </div>
              {artifact.final && <span className="nw-artifact-row__badge nw-artifact-row__badge--final">Final</span>}
              <span className="nw-artifact-row__badge">{artifact.kind.toUpperCase()}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
