import { app } from "../../lib/bridge";
import { createCoworkWorkID, type CoworkWorkRef } from "../../lib/northwingCowork";
import { upsertCoworkWork } from "../../lib/northwingCowork";
import { compileWorkBrief } from "../../lib/northwingWorkSpec";
import {
  normalizeWorkSpec,
  harnessStepsForQuality,
  initialWorkStageForQuality,
  NORTHWING_HARNESS_VERSION,
} from "../../lib/northwingWorkSpec";
import { workbenchTargetToken } from "../../lib/goalSubmit";
import type { TabMeta } from "../../lib/types";
import type { NewWorkFormState } from "./NorthwingNewWork";

export type { NewWorkFormState as NewWorkFormData };

export async function launchNewWork(
  workspaceRoot: string,
  form: NewWorkFormState,
): Promise<{ work: CoworkWorkRef; tab: TabMeta }> {
  const objective = form.objective.trim();
  if (!objective) throw new Error("Describe what you want to finish.");

  const requestedTitle = form.title?.trim() ?? "";
  const title = requestedTitle || (objective.length > 80 ? objective.slice(0, 77) + "..." : objective);
  const workID = createCoworkWorkID();

  // Ensure native Work identity before any provider request.
  const tab = await app.EnsureWorkTab(workspaceRoot, workID);
  if (tab.topicId) await app.RenameTopic(tab.topicId, title).catch(() => undefined);

  // Apply model and reasoning-effort bindings.
  const modelRef = form.modelRef?.trim() ?? "";
  if (modelRef) await app.SetModelForTab(tab.id, modelRef);
  const effort = form.reasoningEffort?.trim() ?? "";
  if (effort) await app.SetEffortForTab(tab.id, effort);
  await app.SetTokenModeForTab(tab.id, "delivery");

  const spec = normalizeWorkSpec({
    objective,
    title,
    kind: form.outputType,
    quality: form.quality,
    sourcePolicy: form.sourcePolicy,
    materials: form.materials,
    audience: form.audience,
    constraints: form.constraints,
    acceptanceCriteria: form.acceptanceCriteria,
    pausePolicy: form.pausePolicy,
    modelRef,
    reasoningEffort: effort,
  });

  const brief = compileWorkBrief(workID, spec);

  // Build the Work metadata before submitting the first goal.
  const work: CoworkWorkRef = {
    id: workID,
    title: spec.title,
    sessionPath: tab.sessionPath ?? "",
    goalId: tab.topicId ?? "",
    profile: "delivery",
    kind: spec.kind,
    quality: spec.quality,
    sourcePolicy: spec.sourcePolicy,
    modelRef: spec.modelRef,
    reasoningEffort: spec.reasoningEffort,
    harnessVersion: NORTHWING_HARNESS_VERSION,
    stage: initialWorkStageForQuality(spec.quality),
    harnessSteps: harnessStepsForQuality(spec.quality),
    currentHarnessStep: harnessStepsForQuality(spec.quality)[0],
    materials: spec.materials,
    expectedArtifact: spec.deliverable,
    audience: spec.audience,
    constraints: spec.constraints,
    pausePolicy: spec.pausePolicy,
    acceptance: spec.acceptanceCriteria.map((text, index) => ({
      id: "acc-" + (index + 1),
      text,
      status: "pending",
    })),
    completedCriteria: 0,
    totalCriteria: spec.acceptanceCriteria.length,
  };

  // Persist the Work to the project.
  await upsertCoworkWork(workspaceRoot, work);

  // Submit the initial goal to Reasonix.
  const target = await localTargetToken();
  await app.SubmitInitialGoalToTab(
    tab.id,
    spec.objective,
    spec.title,
    brief,
    [],
    "goal",
    "auto",
    target.kind,
    target.identityGen,
    target.requestSeq,
  );
  await app.SetActiveTab(tab.id);

  return { work, tab };
}

async function localTargetToken() {
  let target = await app.WorkbenchActiveTarget();
  if (target.kind !== "local") target = await app.WorkbenchSwitchLocal();
  const token = workbenchTargetToken(target);
  if (!token || token.kind !== "local") throw new Error("Northwing could not establish the local project target.");
  return token;
}
