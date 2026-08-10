// Run: node --import tsx --import ./scripts/register-css-test-loader.mjs src/__tests__/northwing-model-settings.test.tsx
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { NorthwingShell } from "../northwing/Shell/NorthwingShell";
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
Object.defineProperty(dom.window.HTMLElement.prototype, "attachEvent", { configurable: true, value: () => {} });
Object.defineProperty(dom.window.HTMLElement.prototype, "detachEvent", { configurable: true, value: () => {} });

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}
function flush() { return new Promise((resolve) => setTimeout(resolve, 50)); }
async function click(element: Element | null | undefined) {
  await act(async () => {
    element?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

let models = [
  { ref: "deepseek/reasoner", provider: "deepseek", model: "reasoner", current: true },
  { ref: "openai/gpt-5", provider: "openai", model: "gpt-5", current: false },
];
(window as typeof window & { go?: { main?: { App?: Record<string, unknown> } } }).go = {
  main: {
    App: {
      Models: async () => models,
      Effort: async () => ({ supported: true, current: "high", default: "medium", levels: ["low", "medium", "high"] }),
      Settings: async () => ({ providers: [] }),
    },
  },
};

console.log("\nNorthwing model and Settings access");
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("missing root");
const root = createRoot(rootElement);
await act(async () => {
  root.render(<LocaleProvider><NorthwingShell initialDestination={{ kind: "new-work", workspaceRoot: "/workspace/project-a" }} /></LocaleProvider>);
  await flush();
});
const modelSelect = document.querySelector<HTMLSelectElement>('select[aria-label="Model"]');
ok(modelSelect, "New Work shows the configured production model catalog");
ok(modelSelect?.textContent?.includes("deepseek / reasoner"), "Model list shows provider and model");
ok(modelSelect?.textContent?.includes("Default: deepseek / reasoner"), "current model is identified as the default");
await click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Advanced")));
const effort = document.querySelector<HTMLSelectElement>('select[aria-label="Reasoning effort"]');
ok(effort, "reasoning effort appears when the current provider supports it");
ok(effort?.textContent?.includes("medium") && effort.textContent.includes("high"), "reasoning effort uses the production capability levels");

models = [];
await act(async () => {
  root.render(<LocaleProvider><NorthwingShell initialDestination={{ kind: "new-work", workspaceRoot: "/workspace/project-a" }} /></LocaleProvider>);
  window.dispatchEvent(new window.Event("reasonix:model-catalog-changed"));
  await flush();
});
ok(document.body.textContent?.includes("No usable model configured"), "empty or unkeyed providers show an actionable no-model state");
const startWork = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Start Work"));
ok(startWork?.disabled, "Work cannot start without a usable model");
const configure = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Configure models"));
ok(configure, "no-model state links to model Settings");
await click(configure);
ok(document.querySelector('[data-northwing-page="settings"]'), "model configuration opens the reused Settings surface");
ok(document.body.textContent?.includes("Settings"), "Settings remains user-visible from Northwing");

await act(async () => {
  root.unmount();
  await flush();
});
if (failed) process.exit(1);
console.log("Northwing model and Settings tests passed");
