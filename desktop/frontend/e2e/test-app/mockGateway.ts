import type { NorthwingCatalog, NorthwingWorkSummary, NorthwingArtifactSummary } from "../../src/northwing/domain/catalog";
import type { NorthwingDestination } from "../../src/northwing/Navigation/routes";
import type { NorthwingShellGateway } from "../../src/northwing/Shell/NorthwingShell";

const mockWork: NorthwingWorkSummary = {
  workId: "work-e2e-001",
  projectId: "proj-e2e-001",
  projectName: "E2E Test Project",
  workspace: "/home/test/e2e-project",
  title: "Test Work: Analysis Report",
  stage: "producing",
  quality: "standard",
  sourcePolicy: "project_plus_web",
  completedCriteria: 3,
  totalCriteria: 8,
  sessionKind: "work",
  bindingStatus: "bound",
  updatedAt: new Date().toISOString(),
};

const mockWaitingWork: NorthwingWorkSummary = {
  workId: "work-e2e-002",
  projectId: "proj-e2e-001",
  projectName: "E2E Test Project",
  workspace: "/home/test/e2e-project",
  title: "Pending approval: Literature Review",
  stage: "waiting_user",
  quality: "deep",
  sourcePolicy: "verified_web",
  completedCriteria: 5,
  totalCriteria: 10,
  sessionKind: "work",
  bindingStatus: "bound",
  updatedAt: new Date().toISOString(),
};

const mockArtifact: NorthwingArtifactSummary = {
  id: "art-e2e-001",
  path: "/home/test/e2e-project/deliverables/work-e2e-001/draft-v3.docx",
  kind: "docx",
  workId: "work-e2e-001",
  version: 3,
  final: true,
  projectId: "proj-e2e-001",
  projectName: "E2E Test Project",
  workspace: "/home/test/e2e-project",
  createdAt: new Date().toISOString(),
};

const defaultCatalog: NorthwingCatalog = {
  projects: [
    {
      id: "proj-e2e-001",
      name: "E2E Test Project",
      workspace: "/home/test/e2e-project",
      updatedAt: new Date().toISOString(),
    },
  ],
  activeWorks: [mockWork],
  waitingForUser: [mockWaitingWork],
  recentArtifacts: [mockArtifact],
};

let catalog = { ...defaultCatalog, activeWorks: [{...mockWork}], waitingForUser: [{...mockWaitingWork}], recentArtifacts: [{...mockArtifact}] };

export function buildMockGateway(): NorthwingShellGateway {
  return {
    workspaceRoots: ["/home/test/e2e-project"],
    readCatalog: async () => {
      // Return a fresh deep copy each time
      return JSON.parse(JSON.stringify(catalog));
    },
    onNewWork: () => void 0,
    onOpenQuickChat: () => void 0,
    onNavigate: () => void 0,
  };
}

/**
 * Override catalog data at runtime for tests that need different fixtures.
 * Called via page.evaluate() in Playwright.
 */
export function __e2e_setCatalog(next: Partial<NorthwingCatalog>): void {
  if (next.projects) catalog.projects = next.projects;
  if (next.activeWorks) catalog.activeWorks = next.activeWorks;
  if (next.waitingForUser) catalog.waitingForUser = next.waitingForUser;
  if (next.recentArtifacts) catalog.recentArtifacts = next.recentArtifacts;
}

export { defaultCatalog };
