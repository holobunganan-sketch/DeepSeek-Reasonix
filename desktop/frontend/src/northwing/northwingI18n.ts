import type { DictKey, Translator } from "../lib/i18n";

const stageKeys: Record<string, DictKey> = {
  intake: "northwing.stage.intake",
  planning: "northwing.stage.planning",
  producing: "northwing.stage.producing",
  reviewing: "northwing.stage.reviewing",
  repairing: "northwing.stage.repairing",
  validating: "northwing.stage.validating",
  waiting_user: "northwing.stage.waiting_user",
  completed: "northwing.stage.completed",
  failed: "northwing.stage.failed",
};

export function northwingStageLabel(t: Translator, stage: string): string {
  const key = stageKeys[stage];
  return key ? t(key) : stage;
}

const destinationKeys: Record<string, DictKey> = {
  home: "northwing.nav.home",
  projects: "northwing.nav.projects",
  project: "northwing.nav.project",
  "work-list": "northwing.nav.work",
  work: "northwing.nav.work",
  artifacts: "northwing.nav.artifacts",
  "quick-chat": "northwing.nav.quickChat",
  settings: "northwing.nav.settings",
  "new-work": "northwing.nav.newWork",
};

export function northwingDestinationLabel(t: Translator, kind: string): string {
  const key = destinationKeys[kind];
  return key ? t(key) : kind;
}
