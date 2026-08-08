import type { NorthwingWorkSummary } from "../domain/catalog";

export type WorkStatusFilter = "all" | "active" | "waiting" | "completed" | "failed";
export type WorkSortOption = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

export type WorkFilterInput = {
  query?: string;
  status?: WorkStatusFilter;
  sort?: WorkSortOption;
};

function matchesStatus(work: NorthwingWorkSummary, status: WorkStatusFilter): boolean {
  if (status === "all" || !status) return true;
  if (status === "active") return work.stage !== "waiting_user" && work.stage !== "completed" && work.stage !== "failed";
  if (status === "waiting") return work.stage === "waiting_user";
  return work.stage === status;
}

function matchesQuery(work: NorthwingWorkSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    work.title.toLowerCase().includes(q) ||
    work.projectName.toLowerCase().includes(q) ||
    work.stage.toLowerCase().includes(q)
  );
}

export function filterWorks(works: NorthwingWorkSummary[], input: WorkFilterInput = {}): NorthwingWorkSummary[] {
  const query = input.query ?? "";
  const status = input.status ?? "all";
  const sort = input.sort ?? "updated_desc";

  const filtered = works.filter((work) => matchesStatus(work, status) && matchesQuery(work, query));

  return filtered.sort((a, b) => {
    switch (sort) {
      case "updated_asc":
        return a.updatedAt.localeCompare(b.updatedAt);
      case "updated_desc":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "title_desc":
        return b.title.localeCompare(a.title);
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
}

export function countWorksByStatus(works: NorthwingWorkSummary[]): Record<WorkStatusFilter, number> {
  return {
    all: works.length,
    active: works.filter((w) => w.stage !== "waiting_user" && w.stage !== "completed" && w.stage !== "failed").length,
    waiting: works.filter((w) => w.stage === "waiting_user").length,
    completed: works.filter((w) => w.stage === "completed").length,
    failed: works.filter((w) => w.stage === "failed").length,
  };
}
