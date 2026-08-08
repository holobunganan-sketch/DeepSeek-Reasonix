// Run: tsx src/__tests__/northwing-work-list.test.tsx
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import React from "react";
import { filterWorks } from "../northwing/Work/workFilters";
import { NorthwingWorkList } from "../northwing/Work/NorthwingWorkList";
import type { NorthwingWorkSummary } from "../northwing/domain/catalog";

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
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

const works: NorthwingWorkSummary[] = [
  {
    workId: "work-report",
    projectId: "proj-1",
    projectName: "Medical strategy",
    workspace: "/workspace/medical-strategy",
    title: "Draft report",
    stage: "waiting_user",
    quality: "standard",
    sourcePolicy: "project_plus_web",
    completedCriteria: 1,
    totalCriteria: 4,
    sessionKind: "work",
    bindingStatus: "native",
    updatedAt: "2026-08-03T12:02:00Z",
  },
  {
    workId: "work-slides",
    projectId: "proj-1",
    projectName: "Medical strategy",
    workspace: "/workspace/medical-strategy",
    title: "Build slides",
    stage: "planning",
    quality: "deep",
    sourcePolicy: "verified_web",
    completedCriteria: 0,
    totalCriteria: 5,
    sessionKind: "work",
    bindingStatus: "native",
    updatedAt: "2026-08-03T12:03:00Z",
  },
  {
    workId: "work-archive",
    projectId: "proj-1",
    projectName: "Medical strategy",
    workspace: "/workspace/medical-strategy",
    title: "Archive data",
    stage: "completed",
    quality: "quick",
    sourcePolicy: "project_only",
    completedCriteria: 3,
    totalCriteria: 3,
    sessionKind: "work",
    bindingStatus: "native",
    updatedAt: "2026-08-03T12:01:00Z",
  },
];

console.log("\nNorthwing Work filters");

equal(
  filterWorks(works, { query: "report", status: "waiting", sort: "updated_desc" }).map((w) => w.workId),
  ["work-report"],
  "filters by query and waiting status",
);

equal(
  filterWorks(works, { status: "active" }).map((w) => w.workId),
  ["work-slides"],
  "active excludes waiting, completed, failed",
);

equal(
  filterWorks(works, { sort: "title_asc" }).map((w) => w.workId),
  ["work-archive", "work-slides", "work-report"],
  "sorts by title ascending",
);

console.log("\nNorthwing Work List");

async function run() {
  const events: string[] = [];
  await render(
    <NorthwingWorkList
      works={works}
      onOpenWork={(work) => events.push(`open:${work.workId}`)}
      onNewWork={() => events.push("new-work")}
    />,
  );

  const h1 = document.querySelector("h1");
  ok(h1?.textContent === "Work", "page has Work heading");

  const newWorkButton = document.querySelector('[aria-label="New Work"]');
  ok(newWorkButton, "New Work button is visible");

  ok(document.body.textContent?.includes("Draft report"), "shows work title");
  ok(document.body.textContent?.includes("Waiting for you"), "shows waiting stage label");
  ok(document.body.textContent?.includes("1/4"), "shows acceptance progress");

  if (failed) process.exit(1);
  console.log("Northwing Work List tests passed");
}

void run();
