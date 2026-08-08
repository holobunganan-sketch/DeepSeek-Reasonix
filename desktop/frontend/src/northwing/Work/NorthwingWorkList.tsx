import { useMemo, useState } from "react";
import { Briefcase, AlertCircle, CheckCircle2, XCircle, Play, Search, ArrowUpDown } from "lucide-react";
import type { NorthwingWorkSummary } from "../domain/catalog";
import { filterWorks, countWorksByStatus, type WorkStatusFilter, type WorkSortOption } from "./workFilters";

export type NorthwingWorkListProps = {
  works: NorthwingWorkSummary[];
  onOpenWork?: (work: NorthwingWorkSummary) => void;
  onNewWork?: () => void;
};

const stageLabels: Record<string, string> = {
  intake: "Intake",
  planning: "Planning",
  producing: "Producing",
  reviewing: "Reviewing",
  repairing: "Repairing",
  validating: "Validating",
  waiting_user: "Waiting for you",
  completed: "Completed",
  failed: "Failed",
};

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function NorthwingWorkList({ works, onOpenWork, onNewWork }: NorthwingWorkListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkStatusFilter>("all");
  const [sort, setSort] = useState<WorkSortOption>("updated_desc");

  const filtered = useMemo(() => filterWorks(works, { query, status, sort }), [works, query, status, sort]);
  const counts = useMemo(() => countWorksByStatus(works), [works]);

  return (
    <main role="main" data-northwing-page="work-list" className="nw-page work-list-page">
      <header className="work-list-page__header">
        <h1 className="nw-page__title">Work</h1>
        <button type="button" className="nw-btn nw-btn--primary" aria-label="New Work" onClick={onNewWork}>
          <Briefcase size={16} aria-hidden="true" />
          <span>New Work</span>
        </button>
      </header>

      <div className="work-list-page__controls">
        <div className="work-list-page__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search work..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search work"
          />
        </div>
        <div className="work-list-page__filters" role="tablist" aria-label="Filter work by status">
          {(["all", "active", "waiting", "completed", "failed"] as WorkStatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={`nw-btn nw-btn--ghost work-list-page__filter${status === s ? " work-list-page__filter--active" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s === "all" && "All"}
              {s === "active" && "Active"}
              {s === "waiting" && "Waiting"}
              {s === "completed" && "Completed"}
              {s === "failed" && "Failed"}
              <span className="work-list-page__count">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="work-list-page__sort">
          <ArrowUpDown size={16} aria-hidden="true" />
          <select value={sort} onChange={(e) => setSort(e.target.value as WorkSortOption)} aria-label="Sort work">
            <option value="updated_desc">Updated: newest first</option>
            <option value="updated_asc">Updated: oldest first</option>
            <option value="title_asc">Title: A-Z</option>
            <option value="title_desc">Title: Z-A</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="nw-card work-list-page__empty">
          <p>No Work matches the current filter.</p>
          <button type="button" className="nw-btn nw-btn--primary" onClick={onNewWork}>
            New Work
          </button>
        </div>
      ) : (
        <ul className="work-list-page__items" role="list">
          {filtered.map((work) => (
            <li
              key={work.workId}
              className="work-list-item"
              tabIndex={0}
              role="button"
              onClick={() => onOpenWork?.(work)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenWork?.(work);
                }
              }}
            >
              <div className="work-list-item__main">
                <div className="work-list-item__title-row">
                  <span className="work-list-item__title">{work.title}</span>
                  {work.bindingStatus === "needs_rebind" && (
                    <span className="work-list-item__rebind" title="Session rebind needed">
                      <AlertCircle size={14} aria-hidden="true" /> needs rebind
                    </span>
                  )}
                </div>
                <div className="work-list-item__meta">
                  <span className="work-list-item__project">{work.projectName}</span>
                  <span className={`work-list-item__stage work-list-item__stage--${work.stage}`}>
                    {stageLabels[work.stage] ?? work.stage}
                  </span>
                  <span className="work-list-item__quality">{work.quality}</span>
                  <span className="work-list-item__source">{work.sourcePolicy.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="work-list-item__aside">
                <span className="work-list-item__acceptance">
                  {work.completedCriteria}/{work.totalCriteria}
                </span>
                <span className="work-list-item__status-icon" aria-hidden="true">
                  {work.stage === "completed" && <CheckCircle2 size={18} />}
                  {work.stage === "failed" && <XCircle size={18} />}
                  {work.stage === "waiting_user" && <AlertCircle size={18} />}
                  {work.stage !== "completed" && work.stage !== "failed" && work.stage !== "waiting_user" && <Play size={18} />}
                </span>
                <time className="work-list-item__time" dateTime={work.updatedAt}>
                  {formatTime(work.updatedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default NorthwingWorkList;
