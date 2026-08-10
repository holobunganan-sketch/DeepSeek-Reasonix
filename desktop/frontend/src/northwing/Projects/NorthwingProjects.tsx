import { FolderKanban, Plus, Search } from "lucide-react";
import { useState, useMemo } from "react";
import type { NorthwingProjectSummary } from "../domain/catalog";

export type NorthwingProjectsProps = {
  projects: NorthwingProjectSummary[];
  onOpenProject?: (project: NorthwingProjectSummary) => void;
  onNewProject?: () => void;
  creatingProject?: boolean;
  createProjectError?: string;
};

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function NorthwingProjects({
  projects,
  onOpenProject,
  onNewProject,
  creatingProject = false,
  createProjectError,
}: NorthwingProjectsProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <main role="main" data-northwing-page="projects" className="nw-page projects-page">
      <header className="projects-page__header">
        <h1 className="nw-page__title">Projects</h1>
        <button
          type="button"
          className="nw-btn nw-btn--primary"
          aria-label="New Project"
          onClick={onNewProject}
          disabled={creatingProject}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{creatingProject ? "Creating..." : "New Project"}</span>
        </button>
      </header>

      {createProjectError && <p className="nw-page__error" role="alert">{createProjectError}</p>}

      <div className="projects-page__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search projects..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search projects"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="nw-card projects-page__empty">
          <FolderKanban size={32} aria-hidden="true" />
          <p>No projects found.</p>
          <button type="button" className="nw-btn nw-btn--primary" onClick={onNewProject} disabled={creatingProject}>
            {creatingProject ? "Creating..." : "New Project"}
          </button>
        </div>
      ) : (
        <ul className="projects-page__list" role="list">
          {filtered.map((project) => (
            <li
              key={project.id ?? project.workspace}
              className="project-row"
              tabIndex={0}
              role="button"
              onClick={() => onOpenProject?.(project)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenProject?.(project);
                }
              }}
            >
              <div className="project-row__main">
              <div className="project-row__title-row">
                <FolderKanban size={18} aria-hidden="true" />
                <span className="project-row__name">{project.name || "Untitled project"}</span>
              </div>
                <div className="project-row__meta">
                  <span>{project.workCount} work{project.workCount === 1 ? "" : "s"}</span>
                  <span>{project.artifactCount} artifact{project.artifactCount === 1 ? "" : "s"}</span>
                </div>
              </div>
              {project.updatedAt && (
                <time className="project-row__time" dateTime={project.updatedAt}>
                  {formatTime(project.updatedAt)}
                </time>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default NorthwingProjects;
