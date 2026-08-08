import { app } from "../../lib/bridge";
import { createCoworkWorkID } from "../../lib/northwingCowork";
import { upsertCoworkWork } from "../../lib/northwingCowork";
import { workbenchTargetToken } from "../../lib/goalSubmit";

export type ConvertChatResult = {
  workId: string;
  tabId: string;
};

export async function convertChatToWork(
  workspaceRoot: string,
  objective: string,
  _chatTabId?: string,
): Promise<ConvertChatResult> {
  if (!workspaceRoot.trim()) throw new Error("No project workspace available for conversion.");
  if (!objective.trim()) throw new Error("Describe what you want to finish.");

  const workId = createCoworkWorkID();

  // Bind the current tab to native Work identity.
  const target = await localTargetToken();
  let tab = await app.EnsureWorkTab(workspaceRoot, workId);
  if (tab.topicId) {
    await app.RenameTopic(tab.topicId, objective.length > 80 ? objective.slice(0, 77) + "..." : objective)
      .catch(() => undefined);
  }

  // Persist a minimal Work contract.
  await upsertCoworkWork(workspaceRoot, {
    id: workId,
    title: objective,
    sessionPath: tab.sessionPath ?? "",
    goalId: tab.topicId ?? "",
    profile: "delivery",
    kind: "general",
    quality: "standard",
    sourcePolicy: "project_only",
    harnessVersion: 3,
    stage: "intake",
    harnessSteps: ["inventory", "plan", "produce", "review", "repair", "validate"],
    currentHarnessStep: "inventory",
    materials: [],
    pausePolicy: "pause",
    acceptance: [],
    completedCriteria: 0,
    totalCriteria: 0,
    constraints: [],
  });

  // Submit a conversion goal that references the existing conversation.
  const brief = [
    "## Conversion from Quick Chat",
    "",
    `Goal: ${objective}`,
    "",
    "Continue from the existing conversation above. The chat history is preserved.",
    "Proceed with inventory, plan, produce, review, repair, and validation.",
  ].join("\n");

  await app.SubmitInitialGoalToTab(
    tab.id,
    objective,
    objective,
    brief,
    [],
    "goal",
    "auto",
    target.kind,
    target.identityGen,
    target.requestSeq,
  );
  await app.SetActiveTab(tab.id);

  return { workId, tabId: tab.id };
}

async function localTargetToken() {
  let target = await app.WorkbenchActiveTarget();
  if (target.kind !== "local") target = await app.WorkbenchSwitchLocal();
  const token = workbenchTargetToken(target);
  if (!token || token.kind !== "local") throw new Error("Northwing could not establish the local project target.");
  return token;
}
