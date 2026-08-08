import { FolderKanban, Briefcase, MessageSquare, Package, Plus } from "lucide-react";
import type { NorthwingProjectSummary, NorthwingWorkSummary, NorthwingArtifactSummary } from "../domain/catalog";

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

export function NorthwingProjectView({
  project,
  works,
  artifacts,
  chats = [],
  onOpenWork,
  onOpenArtifact,
  onOpenChat,
  onNewWork,
}: NorthwingProjectViewProps) {
  return (
    <main role="main" data-northwing-page="project" className="nw-page project-page">
      <header className="project-page__header">
        <div className="project-page__title">
          <FolderKanban size={24} aria-hidden="true" />
          <h1 className="nw-page__title">{project.name}</h1>
        </div>
        <button type="button" className="nw-btn nw-btn--primary" aria-label="New Work" onClick={onNewWork}>
          <Plus size={16} aria-hidden="true" />
          <span>New Work</span>
        </button>
      </header>

      <section className="project-page__section project-page__section--works" aria-labelledby="project-works-heading">
        <div className="project-page__section-header">
          <Briefcase size={18} aria-hidden="true" />
          <h2 id="project-works-heading" className="project-page__section-title">
            Works
          </h2>
          <span className="project-page__count">{works.length}</span>
        </div>
        {works.length === 0 ? (
          <div className="nw-card project-page__empty">
            <p>No Work in this project yet.</p>
            <button type="button" className="nw-btn nw-btn--primary" onClick={onNewWork}>
              New Work
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
                  {stageLabels[work.stage] ?? work.stage}
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
            Recent outputs
          </h2>
          <span className="project-page__count">{artifacts.length}</span>
        </div>
        {artifacts.length === 0 ? (
          <div className="nw-card project-page__empty">
            <p>No artifacts produced yet.</p>
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
                  {artifact.final && <span className="project-artifact-row__final">Final</span>}
                  <time className="project-artifact-row__time" dateTime={artifact.createdAt}>
                    {formatTime(artifact.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="project-page__section project-page__section--chats" aria-labelledby="project-chats-heading">
        <div className="project-page__section-header">
          <MessageSquare size={18} aria-hidden="true" />
          <h2 id="project-chats-heading" className="project-page__section-title">
            Chats
          </h2>
          <span className="project-page__count">{chats.length}</span>
        </div>
        {chats.length === 0 ? (
          <div className="nw-card project-page__empty">
            <p>No recent chats in this project.</p>
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
      </section>
    </main>
  );
}

export default NorthwingProjectView;
