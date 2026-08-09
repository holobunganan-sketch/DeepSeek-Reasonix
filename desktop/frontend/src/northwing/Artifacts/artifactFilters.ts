export interface ArtifactFilterCriteria {
  projectId?: string;
  workId?: string;
  kind?: string;
  finalOnly?: boolean;
  search?: string;
}

export interface FilterableArtifact {
  id: string;
  path: string;
  kind: string;
  workId: string;
  version: number;
  final: boolean;
  projectId: string;
  workspace: string;
  createdAt: string;
}

export function filterArtifacts(
  artifacts: ReadonlyArray<FilterableArtifact>,
  criteria: ArtifactFilterCriteria,
): FilterableArtifact[] {
  const projectId = typeof criteria.projectId === "string" ? criteria.projectId.trim() : "";
  const workId = typeof criteria.workId === "string" ? criteria.workId.trim() : "";
  const kind = typeof criteria.kind === "string" ? criteria.kind.trim().toLowerCase() : "";
  const search = typeof criteria.search === "string" ? criteria.search.trim().toLowerCase() : "";
  const finalOnly = Boolean(criteria.finalOnly);

  return artifacts.filter((artifact) => {
    if (projectId !== "" && artifact.projectId !== projectId) return false;
    if (workId !== "" && artifact.workId !== workId) return false;
    if (kind !== "" && artifact.kind.toLowerCase() !== kind) return false;
    if (finalOnly && !artifact.final) return false;
    if (search !== "") {
      const haystack = [artifact.path, artifact.kind, artifact.projectId, artifact.workId]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function sortArtifactsByTime(
  artifacts: FilterableArtifact[],
  direction: "newest" | "oldest" = "newest",
): FilterableArtifact[] {
  return [...artifacts].sort((a, b) => {
    const cmp = String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    return direction === "newest" ? cmp : -cmp;
  });
}
