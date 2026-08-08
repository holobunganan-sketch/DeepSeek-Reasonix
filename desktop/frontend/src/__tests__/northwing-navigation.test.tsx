// Run: tsx src/__tests__/northwing-navigation.test.tsx
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import React from "react";
import { NorthwingNavigation } from "../northwing/Navigation/NorthwingNavigation";
import type { NorthwingDestination } from "../northwing/Navigation/routes";

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal(actual: string | null | undefined, expected: string, label: string) {
  if (actual === expected) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${actual}, expected ${expected}\n`);
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

console.log("\nNorthwing Navigation");

async function run() {
  const destinations: NorthwingDestination[] = [];
  await render(
    <NorthwingNavigation
      current={{ kind: "home" }}
      onNavigate={(d) => destinations.push(d)}
      onNewWork={() => destinations.push({ kind: "home" })}
    />,
  );

  const homeLink = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes("Home"));
  ok(homeLink, "Home link exists");
  equal(homeLink?.getAttribute("aria-current"), "page", "Home is marked as current page");

  const projectsLink = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes("Projects"));
  await act(async () => {
    projectsLink?.click();
    await flush();
  });
  ok(destinations.length === 1 && destinations[0].kind === "projects", "clicking Projects emits projects destination");

  const workLink = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes("Work"));
  await act(async () => {
    workLink?.click();
    await flush();
  });
  ok(destinations.length === 2 && destinations[1].kind === "work-list", "clicking Work emits work-list destination");

  const artifactsLink = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes("Artifacts"));
  await act(async () => {
    artifactsLink?.click();
    await flush();
  });
  ok(destinations.length === 3 && destinations[2].kind === "artifacts", "clicking Artifacts emits artifacts destination");

  const newWorkButton = document.querySelector('[aria-label="New Work"]');
  ok(newWorkButton, "New Work button exists in navigation");

  const advancedButton = Array.from(document.querySelectorAll("a, button")).find((el) => el.textContent?.includes("Advanced"));
  ok(advancedButton, "Advanced tools entry exists");

  if (failed) process.exit(1);
  console.log("Northwing Navigation tests passed");
}

void run();
