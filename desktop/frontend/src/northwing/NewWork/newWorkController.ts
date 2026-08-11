import type { TabMeta } from "../../lib/types";
import {
  launchCoworkWork,
  type CoworkWorkRef,
} from "../../lib/northwingCowork";
import type { NewWorkFormState } from "./NorthwingNewWork";

export type { NewWorkFormState as NewWorkFormData };

export async function launchNewWork(
  workspaceRoot: string,
  form: NewWorkFormState,
): Promise<{ workspaceRoot: string; work: CoworkWorkRef; tab: TabMeta }> {
  const launched = await launchCoworkWork(workspaceRoot, {
    title: form.title,
    objective: form.objective,
    materials: form.materials,
    kind: form.outputType,
    quality: form.quality,
    sourcePolicy: form.sourcePolicy,
    modelRef: form.modelRef,
    audience: form.audience,
    constraints: form.constraints,
    acceptanceCriteria: form.acceptanceCriteria,
    pausePolicy: form.pausePolicy,
    reasoningEffort: form.reasoningEffort,
  });
  return {
    workspaceRoot: launched.workspaceRoot,
    work: launched.work,
    tab: launched.tab,
  };
}
