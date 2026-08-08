import { ArrowLeft } from "lucide-react";
import type { CoworkWorkRef } from "../../lib/northwingCowork";
import type { WorkStage } from "../../lib/northwingWorkSpec";
import type { NorthwingDestination } from "../Navigation/routes";

const stageLabels: Record<WorkStage, string> = {
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

const qualityLabels: Record<string, string> = {
  quick: "Quick",
  standard: "Standard",
  deep: "Deep",
};

const sourceLabels: Record<string, string> = {
  project_only: "Project materials",
  project_plus_web: "Project + web",
  verified_web: "Verified web",
};

export type NorthwingWorkHeaderProps = {
  work: CoworkWorkRef | null;
  stage: WorkStage;
  completedCriteria: number;
  totalCriteria: number;
  quality: string;
  sourcePolicy: string;
  modelRef?: string;
  onNavigate?: (destination: NorthwingDestination) => void;
};

export function NorthwingWorkHeader({
  work,
  stage,
  completedCriteria,
  totalCriteria,
  quality,
  sourcePolicy,
  modelRef,
  onNavigate,
}: NorthwingWorkHeaderProps) {
  return (
    <header className="nw-work-header">
      <div className="nw-work-header__top">
        <button
          type="button"
          className="nw-btn nw-btn--ghost"
          aria-label="Back to Work list"
          onClick={() => onNavigate?.({ kind: "work-list" })}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <h1 className="nw-work-header__title">{work?.title ?? "Untitled Work"}</h1>
      </div>
      <div className="nw-work-header__meta">
        <span className={`nw-work-header__stage nw-work-header__stage--${stage}`}>
          {stageLabels[stage]}
        </span>
        <span className="nw-work-header__tag">{qualityLabels[quality] ?? quality}</span>
        <span className="nw-work-header__tag">{sourceLabels[sourcePolicy] ?? sourcePolicy}</span>
        {modelRef && <span className="nw-work-header__tag">{modelRef}</span>}
        {totalCriteria > 0 && (
          <span className="nw-work-header__acceptance">
            Acceptance {completedCriteria}/{totalCriteria}
          </span>
        )}
      </div>
    </header>
  );
}

