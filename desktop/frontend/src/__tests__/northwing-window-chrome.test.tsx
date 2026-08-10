// Run with scripts/register-css-test-loader.mjs.
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { NorthwingShell, type NorthwingShellGateway } from "../northwing/Shell/NorthwingShell";
import { LocaleProvider } from "../lib/i18n";

let failed = 0;

function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal<T>(actual: T, expected: T, label: string) {
  if (actual === expected) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${String(actual)}, expected ${String(expected)}\n`);
  }
}

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: "http://localhost/?platform=windows",
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
document.documentElement.setAttribute("data-platform", "windows");
Object.defineProperty(window, "innerWidth", { configurable: true, value: 760 });
Object.defineProperty(window, "innerHeight", { configurable: true, value: 480 });

function flush(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("\nNorthwing Windows window chrome");

async function run() {
  const calls: string[] = [];
  let maximised = false;
  const gateway = {
    readCatalog: async () => ({
      projects: [],
      works: [],
      activeWorks: [],
      waitingForUser: [],
      recentArtifacts: [],
    }),
    windowBridge: {
      MinimiseMainWindow: async () => { calls.push("minimise"); },
      ToggleMaximiseMainWindow: async () => {
        calls.push("toggle");
        maximised = !maximised;
      },
      IsMainWindowMaximised: async () => maximised,
      CloseMainWindow: async () => { calls.push("close"); },
    },
  } as NorthwingShellGateway;

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("missing root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(<LocaleProvider><NorthwingShell gateway={gateway} /></LocaleProvider>);
    await flush();
  });

  const controls = document.querySelector('[aria-label="Window controls"]');
  ok(controls, "Windows production shell renders native window controls on Home");
  equal(controls?.querySelectorAll("button").length ?? 0, 3, "window chrome has exactly three buttons");

  const minimise = document.querySelector<HTMLButtonElement>('[aria-label="Minimize window"]');
  const maximise = document.querySelector<HTMLButtonElement>('[aria-label="Maximize or restore window"]');
  const close = document.querySelector<HTMLButtonElement>('[aria-label="Close window"]');
  ok(minimise && maximise && close, "minimum viewport keeps all window actions in the DOM");

  if (minimise && maximise && close) {
    await act(async () => {
      minimise.click();
      maximise.click();
      close.click();
      await flush(120);
    });
    equal(calls.join("|"), "minimise|toggle|close", "buttons call the native window bridge");
    equal(maximise.getAttribute("aria-pressed"), "true", "maximise state resynchronizes to Restore");

    const topbar = document.querySelector<HTMLElement>(".northwing-shell__topbar");
    await act(async () => {
      topbar?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await flush(120);
    });
    equal(calls.join("|"), "minimise|toggle|close|toggle", "double-clicking the titlebar toggles maximise");
  }

  equal(document.querySelectorAll('[aria-label="Window controls"]').length, 1, "outer shell owns one window-control group");

  await act(async () => {
    root.unmount();
    await flush();
  });
  if (failed) process.exit(1);
  console.log("Northwing Windows window chrome tests passed");
}

void run();
