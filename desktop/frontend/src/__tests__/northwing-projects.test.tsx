// Run: tsx src/__tests__/northwing-projects.test.tsx
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import React from "react";
import { NorthwingProjects } from "../northwing/Projects/NorthwingProjects";
import { NorthwingProjectView } from "../northwing/Projects/NorthwingProjectView";
import type { NorthwingProjectSummary, NorthwingWorkSummary, NorthwingArtifactSummary } from "../northwing/domain/catalog";

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

async function render(element: React.ReactElement) {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("missing root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(element);
    await flush();
  });
  return root;
}

const project: NorthwingProjectSummary = {
  workspace: "/workspace/medical-strategy",
  exists: true,
  id: "proj-1",
  name: "Medical strategy",
  updatedAt: "2026-08-03T12:00:00Z",
  workCount: 2,
  artifactCount: 1,
};

const works: NorthwingWorkSummary[] = [
  {
    workId: "work-123",
    projectId: "proj-1",
    projectName: "Medical strategy",
    workspace: "/workspace/medical-strategy",
    title: "Draft report",
    stage: "planning",
    quality: "standard",
    sourcePolicy: "project_plus_web",
    completedCriteria: 1,
    totalCriteria: 4,
    sessionKind: "work",
    bindingStatus: "native",
    updatedAt: "2026-08-03T12:02:00Z",
  },
];

const artifacts: NorthwingArtifactSummary[] = [
  {
    id: "art-1",
    path: "deliverables/work-123/report.docx",
    kind: "docx",
    workId: "work-123",
    version: 1,
    final: true,
    projectId: "proj-1",
    projectName: "Medical strategy",
    workspace: "/workspace/medical-strategy",
    createdAt: "2026-08-03T12:04:00Z",
  },
];

console.log("\nNorthwing Projects");

async function run() {
  const events: string[] = [];
  await render(
    <NorthwingProjectView
      project={project}
      works={works}
      artifacts={artifacts}
      onOpenWork={(work) => events.push(`open-work:${work.workId}`)}
      onOpenArtifact={(artifact) => events.push(`open-artifact:${artifact.id}`)}
      onNewWork={() => events.push("new-work")}
    />,
  );

  const headings = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent);
  ok(headings.includes("Works"), "shows Works section");
  ok(headings.includes("Recent outputs"), "shows Recent outputs section");
  ok(headings.includes("Chats"), "shows Chats section");

  const newWorkButton = document.querySelector('[aria-label="New Work"]');
  ok(newWorkButton, "New Work button is visible");

  ok(document.body.textContent?.includes("Draft report"), "shows work title");
  ok(document.body.textContent?.includes("report.docx"), "shows artifact name");
  ok(document.body.textContent?.includes("Final"), "shows final badge");

  await render(
    <NorthwingProjects
      projects={[project]}
      onOpenProject={(p) => events.push(`open-project:${p.id}`)}
      onNewProject={() => events.push("new-project")}
    />,
  );

  const h1 = document.querySelector("h1");
  ok(h1?.textContent === "Projects", "projects list has Projects heading");
  ok(document.body.textContent?.includes("Medical strategy"), "shows project name");

  if (failed) process.exit(1);
  console.log("Northwing Projects tests passed");
}

void run();
