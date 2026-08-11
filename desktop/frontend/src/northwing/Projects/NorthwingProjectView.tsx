import { FolderKanban, Briefcase, MessageSquare, Package, Plus } from "lucide-react";
import type { NorthwingProjectSummary, NorthwingWorkSummary, NorthwingArtifactSummary } from "../domain/catalog";
import { useT } from "../../lib/i18n";
import { northwingStageLabel } from "../northwingI18n";

export type NorthwingProjectViewProps = {
  project: NorthwingProjectSummary;
  works: NorthwingWorkSummary[];
  artifacts: NorthwingArtifactSummary[];
  chats?: { id: string; title: string; updatedAt: string }[];
  onOpenWork?: (work: NorthwingWorkSummary) => void;
  onOpenArtifact?: (artifact: NorthwingArtifactSummary) => void;
  onOpenChat?: (chat: { id: string; title: string; updatedAt: string }) => void;
  onNewWork?: () => void;
};

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function NorthwingProjectView({
  project,
  works,
  artifacts,
  chats,
  onOpenWork,
  onOpenArtifact,
  onOpenChat,
  onNewWork,
}: NorthwingProjectViewProps) {
  const t = useT();
  return (
    <main role="main" data-northwing-page="project" className="nw-page project-page">
      <header className="project-page__header">
        <div className="project-page__title">
          <FolderKanban size={24} aria-hidden="true" />
          <h1 className="nw-page__title">{project.name}</h1>
        </div>
        <button type="button" className="nw-btn nw-btn--primary" aria-label={t("northwing.nav.newWork")} onClick={onNewWork}>
          <Plus size={16} aria-hidden="true" />
          <span>{t("northwing.nav.newWork")}</span>
        </button>
      </header>

      <section className="project-page__section project-page__section--works" aria-labelledby="project-works-heading">
        <div className="project-page__section-header">
          <Briefcase size={18} aria-hidden="true" />
          <h2 id="project-works-heading" className="project-page__section-title">
            {t("northwing.project.works")}
          </h2>
          <span className="project-page__count">{works.length}</span>
        </div>
        {works.length === 0 ? (
          <div className="nw-card project-page__empty">
            <p>{t("northwing.project.noWork")}</p>
            <button type="button" className="nw-btn nw-btn--primary" onClick={onNewWork}>
              {t("northwing.nav.newWork")}
            </button>
          </div>
        ) : (
          <ul className="project-page__works" role="list">
            {works.map((work) => (
              <li
                key={work.workId}
                className="project-work-row"
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
                <span className="project-work-row__title">{work.title}</span>
                <span className={`project-work-row__stage project-work-row__stage--${work.stage}`}>
                  {northwingStageLabel(t, work.stage)}
                </span>
                <span className="project-work-row__acceptance">
                  {work.completedCriteria}/{work.totalCriteria}
                </span>
                <time className="project-work-row__time" dateTime={work.updatedAt}>
                  {formatTime(work.updatedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="project-page__section project-page__section--outputs" aria-labelledby="project-outputs-heading">
        <div className="project-page__section-header">
          <Package size={18} aria-hidden="true" />
          <h2 id="project-outputs-heading" className="project-page__section-title">
            {t("northwing.project.outputs")}
          </h2>
          <span className="project-page__count">{artifacts.length}</span>
        </div>
        {artifacts.length === 0 ? (
          <div className="nw-card project-page__empty">
            <p>{t("northwing.project.noArtifacts")}</p>
          </div>
        ) : (
          <ul className="project-page__artifacts" role="list">
            {artifacts.map((artifact) => {
              const fileName = artifact.path.split("/").pop() ?? artifact.path;
              return (
                <li
                  key={artifact.id}
                  className="project-artifact-row"
                  tabIndex={0}
                  role="button"
                  onClick={() => onOpenArtifact?.(artifact)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenArtifact?.(artifact);
                    }
                  }}
                >
                  <span className="project-artifact-row__name">{fileName}</span>
                  <span className="project-artifact-row__kind">{artifact.kind.toUpperCase()}</span>
                  {artifact.final && <span className="project-artifact-row__final">{t("northwing.project.final")}</span>}
                  <time className="project-artifact-row__time" dateTime={artifact.createdAt}>
                    {formatTime(artifact.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {chats && onOpenChat && <section className="project-page__section project-page__section--chats" aria-labelledby="project-chats-heading">
        <div className="project-page__section-header">
          <MessageSquare size={18} aria-hidden="true" />
          <h2 id="project-chats-heading" className="project-page__section-title">
            {t("northwing.project.chats")}
          </h2>
          <span className="project-page__count">{chats.length}</span>
        </div>
        {chats.length === 0 ? (
          <div className="nw-card project-page__empty">
            <p>{t("northwing.project.noChats")}</p>
          </div>
        ) : (
          <ul className="project-page__chats" role="list">
            {chats.map((chat) => (
              <li
                key={chat.id}
                className="project-chat-row"
                tabIndex={0}
                role="button"
                onClick={() => onOpenChat?.(chat)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenChat?.(chat);
                  }
                }}
              >
                <span className="project-chat-row__title">{chat.title}</span>
                <time className="project-chat-row__time" dateTime={chat.updatedAt}>
                  {formatTime(chat.updatedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>}
    </main>
  );
}

export default NorthwingProjectView;
