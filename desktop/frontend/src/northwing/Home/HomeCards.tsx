import { FileText, FolderKanban, Package, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { NorthwingWorkSummary, NorthwingArtifactSummary, NorthwingProjectSummary } from "../domain/catalog";
import { useT } from "../../lib/i18n";
import { northwingStageLabel } from "../northwingI18n";

type WorkCardProps = {
  work: NorthwingWorkSummary;
  onClick?: (work: NorthwingWorkSummary) => void;
  showProject?: boolean;
};

function formatTimeAgo(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function WorkCard({ work, onClick, showProject = true }: WorkCardProps) {
  const t = useT();
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
        <span className={`home-card__stage home-card__stage--${work.stage}`}>{northwingStageLabel(t, work.stage)}</span>
        <span className="home-card__acceptance">
          {t("northwing.home.acceptance", { done: work.completedCriteria, total: work.totalCriteria })}
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
  const t = useT();
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
        {artifact.final && <CheckCircle2 size={16} className="home-card__status-icon home-card__status-icon--final" aria-label={t("northwing.project.final")} />}
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
  const t = useT();
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
        {t("northwing.home.projectCounts", { works: project.workCount, artifacts: project.artifactCount })}
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
  const t = useT();
  return (
    <article className="nw-card home-card home-card--new-work">
      <div className="home-card__header">
        <FileText size={24} aria-hidden="true" />
        <h3 className="home-card__title">{t("northwing.nav.newWork")}</h3>
      </div>
      <p className="home-card__meta">{t("northwing.home.newWorkBody")}</p>
      <button type="button" className="nw-btn nw-btn--primary home-card__action" aria-label={t("northwing.nav.newWork")} onClick={onClick}>
        {t("northwing.home.createWork")}
      </button>
    </article>
  );
}
