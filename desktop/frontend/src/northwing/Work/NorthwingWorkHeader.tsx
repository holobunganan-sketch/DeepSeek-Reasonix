import { ArrowLeft } from "lucide-react";
import type { CoworkWorkRef } from "../../lib/northwingCowork";
import type { WorkStage } from "../../lib/northwingWorkSpec";
import type { NorthwingDestination } from "../Navigation/routes";
import { useT, type DictKey } from "../../lib/i18n";
import { northwingStageLabel } from "../northwingI18n";

const qualityKeys: Record<string, DictKey> = {
  quick: "northwing.quality.quick",
  standard: "northwing.quality.standard",
  deep: "northwing.quality.deep",
};

const sourceKeys: Record<string, DictKey> = {
  project_only: "northwing.source.project_only",
  project_plus_web: "northwing.source.project_plus_web",
  verified_web: "northwing.source.verified_web",
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
  const t = useT();
  return (
    <header className="nw-work-header">
      <div className="nw-work-header__top">
        <button
          type="button"
          className="nw-btn nw-btn--ghost"
          aria-label={t("northwing.work.back")}
          onClick={() => onNavigate?.({ kind: "work-list" })}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <h1 className="nw-work-header__title">{work?.title ?? t("northwing.work.untitled")}</h1>
      </div>
      <div className="nw-work-header__meta">
        <span className={`nw-work-header__stage nw-work-header__stage--${stage}`}>
          {northwingStageLabel(t, stage)}
        </span>
        <span className="nw-work-header__tag">{qualityKeys[quality] ? t(qualityKeys[quality]) : quality}</span>
        <span className="nw-work-header__tag">{sourceKeys[sourcePolicy] ? t(sourceKeys[sourcePolicy]) : sourcePolicy}</span>
        {modelRef && <span className="nw-work-header__tag">{modelRef}</span>}
        {totalCriteria > 0 && (
          <span className="nw-work-header__acceptance">
            {t("northwing.work.acceptance", { done: completedCriteria, total: totalCriteria })}
          </span>
        )}
      </div>
    </header>
  );
}
