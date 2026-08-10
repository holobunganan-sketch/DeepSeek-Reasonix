import "./NorthwingWork.css";
import { useMemo } from "react";
import { NorthwingWorkHeader } from "./NorthwingWorkHeader";
import { NorthwingWorkPlan } from "./NorthwingWorkPlan";
import { NorthwingWorkActivity } from "./NorthwingWorkActivity";
import { NorthwingMaterialsPanel } from "./NorthwingMaterialsPanel";
import { useNorthwingWorkProjection } from "./useNorthwingWorkProjection";
import type { NorthwingDestination } from "../Navigation/routes";
import type { CoworkWorkRef, CoworkArtifact, CoworkProject } from "../../lib/northwingCowork";
import { useT } from "../../lib/i18n";

export type NorthwingWorkViewProps = {
  workspaceRoot: string;
  workId: string;
  work?: CoworkWorkRef;
  project?: CoworkProject;
  artifacts?: CoworkArtifact[];
  SessionWorkspace?: React.ComponentType<{ destination: NorthwingDestination }>;
  onNavigate?: (destination: NorthwingDestination) => void;
};

export function NorthwingWorkView({
  workspaceRoot,
  workId,
  work: initialWork,
  project,
  artifacts = [],
  SessionWorkspace,
  onNavigate,
}: NorthwingWorkViewProps) {
  const t = useT();
  const projection = useNorthwingWorkProjection(workspaceRoot, workId);
  const resolvedWork = initialWork ?? projection.work;
  const resolvedArtifacts = useMemo(() => {
    if (artifacts.length > 0) return artifacts;
    if (project) return (project.artifacts ?? []).filter((a) => a.workId === workId);
    return projection.artifacts;
  }, [artifacts, project, projection.artifacts, workId]);

  if (projection.loading) {
    return (
      <div className="nw-page nw-work-view">
        <p className="nw-page__subtitle">{t("northwing.work.loading")}</p>
      </div>
    );
  }

  if (projection.error) {
    return (
      <div className="nw-page nw-work-view">
        <h1 className="nw-page__title">{t("northwing.work.unavailable")}</h1>
        <p className="nw-page__subtitle">{projection.error}</p>
      </div>
    );
  }

  const destination: NorthwingDestination = { kind: "work", workspaceRoot, workId };

  return (
    <div className="nw-work-view" role="main" data-northwing-page="work" data-work-id={workId}>
      <NorthwingWorkHeader
        work={resolvedWork}
        stage={projection.stage}
        completedCriteria={resolvedWork?.completedCriteria ?? 0}
        totalCriteria={resolvedWork?.totalCriteria ?? 0}
        quality={resolvedWork?.quality ?? "standard"}
        sourcePolicy={resolvedWork?.sourcePolicy ?? "project_only"}
        modelRef={resolvedWork?.modelRef}
        onNavigate={onNavigate}
      />
      <div className="nw-work-view__body">
        <aside className="nw-work-view__left" aria-label={t("northwing.work.plan")}>
          <NorthwingWorkPlan
            stage={projection.stage}
            currentHarnessStep={projection.currentHarnessStep}
            harnessSteps={resolvedWork?.harnessSteps}
            acceptance={projection.acceptance}
            unresolvedFindings={projection.unresolvedFindings}
          />
        </aside>
        <section className="nw-work-view__center" aria-label={t("northwing.work.activity")}>
          {SessionWorkspace ? (
            <NorthwingWorkActivity destination={destination} SessionWorkspace={SessionWorkspace} />
          ) : (
            <div className="nw-work-view__placeholder">
              <p>{t("northwing.work.sessionUnavailable")}</p>
            </div>
          )}
        </section>
        <aside className="nw-work-view__right" aria-label={t("northwing.work.materialsArtifacts")}>
          <NorthwingMaterialsPanel
            workspaceRoot={workspaceRoot}
            materials={resolvedWork?.materials}
            artifacts={resolvedArtifacts}
            expectedArtifact={resolvedWork?.expectedArtifact}
          />
        </aside>
      </div>
    </div>
  );
}

export default NorthwingWorkView;
