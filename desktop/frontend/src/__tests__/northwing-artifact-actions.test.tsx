// Run: node --import tsx --import ./scripts/register-css-test-loader.mjs src/__tests__/northwing-artifact-actions.test.tsx
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { NorthwingArtifacts } from "../northwing/Artifacts/NorthwingArtifacts";
import { NorthwingMaterialsPanel } from "../northwing/Work/NorthwingMaterialsPanel";
import type { CoworkArtifact } from "../lib/northwingCowork";
import { LocaleProvider } from "../lib/i18n";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
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
globalThis.MouseEvent = dom.window.MouseEvent;

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}
function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
  }
}
function flush() { return new Promise((resolve) => setTimeout(resolve, 40)); }
async function click(button: Element | undefined) {
  await act(async () => {
    button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flush();
  });
}
function button(label: string) {
  return Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(label));
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("missing root");
const root = createRoot(rootElement);

console.log("\nNorthwing Artifact actions");
const actions: string[] = [];
const artifact = {
  id: "artifact-1",
  path: "deliverables/work-1/report.docx",
  kind: "docx",
  workId: "work-1",
  version: 2,
  final: false,
  projectId: "project-1",
  projectName: "Project One",
  workspace: "/workspace/project-1",
  createdAt: "2026-08-10T00:00:00Z",
};
await act(async () => {
  root.render(
    <LocaleProvider><NorthwingArtifacts
      artifacts={[artifact]}
      onPreview={async (selected) => { actions.push(`preview:${selected.id}`); }}
      onOpen={async (selected) => { actions.push(`open:${selected.id}`); }}
      onReveal={async (selected) => { actions.push(`reveal:${selected.id}`); }}
      onMarkFinal={async (selected) => { actions.push(`final:${selected.id}`); }}
    /></LocaleProvider>,
  );
  await flush();
});

ok(document.body.textContent?.includes("Project One"), "artifact row shows Project ownership");
ok(document.body.textContent?.includes("work-1"), "artifact row shows Work ownership");
for (const action of ["Preview", "Open", "Reveal", "Set final"]) {
  ok(button(action), `${action} action is visible`);
  await click(button(action));
}
equal(actions, ["preview:artifact-1", "open:artifact-1", "reveal:artifact-1", "final:artifact-1"], "all Artifact actions invoke their wired callbacks");

console.log("\nNorthwing Artifact versions immutability");
const versions: CoworkArtifact[] = [
  { id: "v1", path: "deliverables/work-1/report.docx", kind: "docx", workId: "work-1", version: 1, sha256: "1", size: 1, createdAt: "2026-08-01T00:00:00Z" },
  { id: "v3", path: "deliverables/work-1/report.docx", kind: "docx", workId: "work-1", version: 3, sha256: "3", size: 3, createdAt: "2026-08-03T00:00:00Z" },
  { id: "v2", path: "deliverables/work-1/report.docx", kind: "docx", workId: "work-1", version: 2, sha256: "2", size: 2, createdAt: "2026-08-02T00:00:00Z" },
];
const originalOrder = versions.map((version) => version.id);
await act(async () => {
  root.render(<LocaleProvider><NorthwingMaterialsPanel workspaceRoot="/workspace/project-1" artifacts={versions} /></LocaleProvider>);
  await flush();
});
await click(button("Versions"));
equal(versions.map((version) => version.id), originalOrder, "Versions rendering does not mutate the artifacts prop");
equal(
  Array.from(document.querySelectorAll(".nw-materials-panel__file-name")).map((element) => element.textContent),
  ["report.docx (v3)", "report.docx (v2)", "report.docx (v1)"],
  "Versions render newest version first",
);

await act(async () => {
  root.unmount();
  await flush();
});
if (failed) process.exit(1);
console.log("Northwing Artifact action tests passed");
