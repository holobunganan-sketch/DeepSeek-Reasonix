import type { WorkStage, HarnessStep } from "../../lib/northwingWorkSpec";
import type { AcceptanceItem } from "./NorthwingWorkCoordinator";

const stepLabels: Record<string, string> = {
  inspect: "Inspect inputs",
  inventory: "Inventory materials",
  evidence_ledger: "Evidence ledger",
  plan: "Plan approach",
  produce: "Produce output",
  review: "Self-review",
  independent_review: "Independent review",
  repair: "Repair findings",
  validate: "Validate output",
  requirement_audit: "Requirement audit",
};

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

export type NorthwingWorkPlanProps = {
  stage: WorkStage;
  currentHarnessStep: HarnessStep;
  harnessSteps?: string[];
  acceptance: AcceptanceItem[];
  unresolvedFindings: string[];
};

export function NorthwingWorkPlan({
  stage,
  currentHarnessStep,
  harnessSteps,
  acceptance,
  unresolvedFindings,
}: NorthwingWorkPlanProps) {
  const steps = harnessSteps ?? [];

  return (
    <div className="nw-work-plan">
      <section className="nw-work-plan__section" aria-labelledby="nw-work-plan-stages-heading">
        <h2 id="nw-work-plan-stages-heading" className="nw-work-plan__heading">
          Progress
        </h2>
        <div className={`nw-work-plan__stage-badge nw-work-plan__stage-badge--${stage}`}>
          {stageLabels[stage]}
        </div>
        {steps.length > 0 && (
          <ol className="nw-work-plan__steps" aria-label="Harness steps">
            {steps.map((step, index) => {
              const label = stepLabels[step] ?? step.replaceAll("_", " ");
              const isCurrent = step === currentHarnessStep;
              const isPast = steps.indexOf(currentHarnessStep) > index;
              return (
                <li
                  key={step}
                  className={`nw-work-plan__step${isCurrent ? " nw-work-plan__step--current" : ""}${isPast ? " nw-work-plan__step--past" : ""}`}
                >
                  <span className="nw-work-plan__step-dot" aria-hidden="true" />
                  <span className="nw-work-plan__step-label">{label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="nw-work-plan__section" aria-labelledby="nw-work-plan-acceptance-heading">
        <h2 id="nw-work-plan-acceptance-heading" className="nw-work-plan__heading">
          Acceptance
        </h2>
        {acceptance.length === 0 ? (
          <p className="nw-work-plan__empty">No acceptance criteria defined.</p>
        ) : (
          <ul className="nw-work-plan__acceptance" aria-label="Acceptance criteria">
            {acceptance.map((item) => (
              <li
                key={item.id}
                className={`nw-work-plan__acceptance-item nw-work-plan__acceptance-item--${item.status}`}
              >
                <span className="nw-work-plan__acceptance-icon" aria-hidden="true">
                  {item.status === "done" || item.status === "met" ? "\u2713" : "\u25CB"}
                </span>
                <span className="nw-work-plan__acceptance-text">{item.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unresolvedFindings.length > 0 && (
        <section className="nw-work-plan__section" aria-labelledby="nw-work-plan-findings-heading">
          <h2 id="nw-work-plan-findings-heading" className="nw-work-plan__heading">
            Findings
          </h2>
          <ul className="nw-work-plan__findings" aria-label="Unresolved findings">
            {unresolvedFindings.map((finding, index) => (
              <li key={index} className="nw-work-plan__finding">
                {finding}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
