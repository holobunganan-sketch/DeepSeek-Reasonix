// Run with scripts/register-css-test-loader.mjs.
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import SessionWorkspace from "../SessionWorkspace";

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

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

console.log("\nNorthwing session workspace adapter");

async function run() {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("missing root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(
      <SessionWorkspace
        destination={{ kind: "work", workspaceRoot: "C:/projects/a", workId: "work-123" }}
        sessionGateway={{
          EnsureWorkTab: async () => { throw new Error("Work session unavailable"); },
          EnsureBlankTab: async () => ({ id: "unused" }),
          SetActiveTab: async () => {},
        }}
      />,
    );
    await flush();
  });

  const alert = document.querySelector('[role="alert"]');
  ok(alert?.textContent === "Work session unavailable", "adapter failures are visible and do not mount another session");

  await act(async () => {
    root.unmount();
    await flush();
  });
  if (failed) process.exit(1);
  console.log("Northwing session workspace adapter tests passed");
}

void run();
