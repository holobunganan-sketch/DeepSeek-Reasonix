import { FileText, FolderKanban, Package, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { NorthwingWorkSummary, NorthwingArtifactSummary, NorthwingProjectSummary } from "../domain/catalog";

type WorkCardProps = {
  work: NorthwingWorkSummary;
  onClick?: (work: NorthwingWorkSummary) => void;
  showProject?: boolean;
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

function formatTimeAgo(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function WorkCard({ work, onClick, showProject = true }: WorkCardProps) {
  const waiting = work.stage === "waiting_user";
  return (
    <article
      className="nw-card home-card home-card--work"
      tabIndex={0}
      role="button"
      onClick={() => onClick?.(work)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(work);
        }
      }}
    >
      <div className="home-card__header">
        <h3 className="home-card__title">{work.title}</h3>
        {waiting ? <AlertCircle size={16} className="home-card__status-icon home-card__status-icon--waiting" /> : <Play size={16} className="home-card__status-icon" />}
      </div>
      {showProject && <p className="home-card__meta">{work.projectName}</p>}
      <div className="home-card__footer">
        <span className={`home-card__stage home-card__stage--${work.stage}`}>{stageLabels[work.stage] ?? work.stage}</span>
        <span className="home-card__acceptance">
          {work.completedCriteria}/{work.totalCriteria} acceptance
        </span>
      </div>
      {work.updatedAt && (
        <time className="home-card__time" dateTime={work.updatedAt}>
          {formatTimeAgo(work.updatedAt)}
        </time>
      )}
    </article>
  );
}

type ArtifactCardProps = {
  artifact: NorthwingArtifactSummary;
  onClick?: (artifact: NorthwingArtifactSummary) => void;
};

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const fileName = artifact.path.split("/").pop() ?? artifact.path;
  return (
    <article
      className="nw-card home-card home-card--artifact"
      tabIndex={0}
      role="button"
      onClick={() => onClick?.(artifact)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(artifact);
        }
      }}
    >
      <div className="home-card__header">
        <Package size={16} aria-hidden="true" />
        <h3 className="home-card__title">{fileName}</h3>
        {artifact.final && <CheckCircle2 size={16} className="home-card__status-icon home-card__status-icon--final" aria-label="Final" />}
      </div>
      <p className="home-card__meta">{artifact.kind.toUpperCase()}</p>
      <p className="home-card__meta">{artifact.projectName}</p>
      {artifact.createdAt && (
        <time className="home-card__time" dateTime={artifact.createdAt}>
          {formatTimeAgo(artifact.createdAt)}
        </time>
      )}
    </article>
  );
}

type ProjectCardProps = {
  project: NorthwingProjectSummary;
  onClick?: (project: NorthwingProjectSummary) => void;
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <article
      className="nw-card home-card home-card--project"
      tabIndex={0}
      role="button"
      onClick={() => onClick?.(project)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(project);
        }
      }}
    >
      <div className="home-card__header">
        <FolderKanban size={16} aria-hidden="true" />
        <h3 className="home-card__title">{project.name}</h3>
      </div>
      <p className="home-card__meta">
        {project.workCount} work{project.workCount === 1 ? "" : "s"} · {project.artifactCount} artifact
        {project.artifactCount === 1 ? "" : "s"}
      </p>
      {project.updatedAt && (
        <time className="home-card__time" dateTime={project.updatedAt}>
          {formatTimeAgo(project.updatedAt)}
        </time>
      )}
    </article>
  );
}

type EmptyCardProps = {
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function EmptyCard({ title, message, action }: EmptyCardProps) {
  return (
    <article className="nw-card home-card home-card--empty">
      <div className="home-card__header">
        <Clock size={16} aria-hidden="true" />
        <h3 className="home-card__title">{title}</h3>
      </div>
      <p className="home-card__meta">{message}</p>
      {action && (
        <button type="button" className="nw-btn nw-btn--ghost home-card__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </article>
  );
}

export function NewWorkCard({ onClick }: { onClick?: () => void }) {
  return (
    <article className="nw-card home-card home-card--new-work">
      <div className="home-card__header">
        <FileText size={24} aria-hidden="true" />
        <h3 className="home-card__title">New Work</h3>
      </div>
      <p className="home-card__meta">Start a new Work with acceptance, materials, and formal output.</p>
      <button type="button" className="nw-btn nw-btn--primary home-card__action" aria-label="New Work" onClick={onClick}>
        Create Work
      </button>
    </article>
  );
}
