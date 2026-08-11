import { MessageSquare } from "lucide-react";
import type {
  NorthwingCatalog,
  NorthwingWorkSummary,
  NorthwingArtifactSummary,
  NorthwingProjectSummary,
} from "../domain/catalog";
import { NewWorkCard, WorkCard, ArtifactCard, ProjectCard, EmptyCard } from "./HomeCards";
import { useT } from "../../lib/i18n";

export type NorthwingHomeProps = {
  catalog: NorthwingCatalog;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onNewWork?: () => void;
  onOpenWork?: (work: NorthwingWorkSummary) => void;
  onOpenArtifact?: (artifact: NorthwingArtifactSummary) => void;
  onOpenProject?: (project: NorthwingProjectSummary) => void;
  onQuickChat?: () => void;
};

export function NorthwingHome({
  catalog,
  loading,
  error,
  onRetry,
  onNewWork,
  onOpenWork,
  onOpenArtifact,
  onOpenProject,
  onQuickChat,
}: NorthwingHomeProps) {
  const t = useT();
  if (loading) {
    return (
      <main role="main" data-northwing-page="home" className="nw-page home-page home-page--loading">
        <h1 className="nw-page__title">{t("northwing.nav.home")}</h1>
        <p className="nw-page__subtitle">{t("northwing.home.loading")}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main role="main" data-northwing-page="home" className="nw-page home-page home-page--error">
        <h1 className="nw-page__title">{t("northwing.nav.home")}</h1>
        <p className="nw-page__subtitle">{error}</p>
        {onRetry && (
          <button type="button" className="nw-btn nw-btn--primary" onClick={onRetry}>
            {t("common.retry")}
          </button>
        )}
      </main>
    );
  }

  return (
    <main role="main" data-northwing-page="home" className="nw-page home-page">
      <header className="home-page__header">
        <div>
          <h1 className="nw-page__title">{t("northwing.nav.home")}</h1>
          <p className="nw-page__subtitle">{t("northwing.home.tagline")}</p>
        </div>
        <button type="button" className="nw-btn nw-btn--ghost home-page__quick-chat" onClick={onQuickChat}>
          <MessageSquare size={16} aria-hidden="true" />
          <span>{t("northwing.nav.quickChat")}</span>
        </button>
      </header>

      <section className="home-section" aria-labelledby="home-continue-heading">
        <div className="home-section__header">
          <h2 id="home-continue-heading" className="home-section__title">
            {t("northwing.home.continue")}
          </h2>
        </div>
        <div className="home-grid">
          <NewWorkCard onClick={onNewWork} />
          {catalog.activeWorks.length === 0 ? (
            <EmptyCard title={t("northwing.home.noActive")} message={t("northwing.home.noActiveBody")} action={{ label: t("northwing.nav.newWork"), onClick: () => onNewWork?.() }} />
          ) : (
            catalog.activeWorks.map((work) => <WorkCard key={work.workId} work={work} onClick={onOpenWork} />)
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-waiting-heading">
        <div className="home-section__header">
          <h2 id="home-waiting-heading" className="home-section__title">
            {t("northwing.home.waiting")}
          </h2>
        </div>
        <div className="home-grid">
          {catalog.waitingForUser.length === 0 ? (
            <EmptyCard title={t("northwing.home.nothingWaiting")} message={t("northwing.home.nothingWaitingBody")} />
          ) : (
            catalog.waitingForUser.map((work) => <WorkCard key={work.workId} work={work} onClick={onOpenWork} showProject={false} />)
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-artifacts-heading">
        <div className="home-section__header">
          <h2 id="home-artifacts-heading" className="home-section__title">
            {t("northwing.home.recentArtifacts")}
          </h2>
        </div>
        <div className="home-grid">
          {catalog.recentArtifacts.length === 0 ? (
            <EmptyCard title={t("northwing.home.noArtifacts")} message={t("northwing.home.noArtifactsBody")} />
          ) : (
            catalog.recentArtifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} onClick={onOpenArtifact} />)
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-projects-heading">
        <div className="home-section__header">
          <h2 id="home-projects-heading" className="home-section__title">
            {t("northwing.home.recentProjects")}
          </h2>
        </div>
        <div className="home-grid">
          {catalog.projects.length === 0 ? (
            <EmptyCard title={t("northwing.home.noProjects")} message={t("northwing.home.noProjectsBody")} action={{ label: t("northwing.nav.newWork"), onClick: () => onNewWork?.() }} />
          ) : (
            catalog.projects.map((project) => <ProjectCard key={project.id ?? project.workspace} project={project} onClick={onOpenProject} />)
          )}
        </div>
      </section>
    </main>
  );
}

export default NorthwingHome;
