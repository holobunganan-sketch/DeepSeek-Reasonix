// Run: node --import tsx --import ./scripts/register-css-test-loader.mjs src/__tests__/northwing-i18n.test.tsx
import { JSDOM } from "jsdom";
import React, { useEffect, type ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider, preloadLocale, useI18n, type LangPref } from "../lib/i18n";
import { NorthwingShell } from "../northwing/Shell/NorthwingShell";

const dom = new JSDOM('<!doctype html><html data-platform="windows"><body><div id="root"></div></body></html>', {
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

(window as typeof window & { go?: { main?: { App?: Record<string, unknown> } } }).go = {
  main: {
    App: {
      Models: async () => [{ ref: "openai/gpt-5.6", provider: "openai", model: "gpt-5.6", current: true }],
      Effort: async () => ({ supported: true, current: "medium", default: "medium", levels: ["low", "medium", "high"] }),
    },
  },
};

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}
function flush() { return new Promise((resolve) => setTimeout(resolve, 80)); }
async function click(element: Element | null | undefined) {
  await act(async () => {
    element?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

function ForceLocale({ locale, children }: { locale: LangPref; children: ReactNode }) {
  const { setPref } = useI18n();
  useEffect(() => setPref(locale), [locale, setPref]);
  return children;
}

console.log("\nNorthwing product localization");
await preloadLocale("zh");
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("missing root");
const root = createRoot(rootElement);
const gateway = {
  readCatalog: async () => ({ projects: [], works: [], activeWorks: [], waitingForUser: [], recentArtifacts: [] }),
  windowBridge: {
    MinimiseMainWindow: async () => {},
    ToggleMaximiseMainWindow: async () => {},
    IsMainWindowMaximised: async () => false,
    CloseMainWindow: async () => {},
  },
};

await act(async () => {
  root.render(
    <LocaleProvider>
      <ForceLocale locale="zh">
        <NorthwingShell gateway={gateway} />
      </ForceLocale>
    </LocaleProvider>,
  );
  await flush();
});

ok(document.documentElement.lang === "zh-CN", "Simplified Chinese locale updates the document language");
ok(document.body.textContent?.includes("主页"), "Home title and navigation use Simplified Chinese");
ok(document.body.textContent?.includes("继续工作"), "Home sections use the active locale");
ok(document.querySelector('[aria-label="最小化窗口"]'), "window actions use the active locale");

const newWork = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("新建任务"));
await click(newWork);
ok(document.querySelector('[data-northwing-page="new-work"]'), "localized navigation still routes to New Work");
ok(document.body.textContent?.includes("项目文件夹"), "New Work fields use Simplified Chinese");
ok(document.body.textContent?.includes("开始任务"), "New Work action uses Simplified Chinese");

await act(async () => {
  root.render(
    <LocaleProvider>
      <ForceLocale locale="en">
        <NorthwingShell initialDestination={{ kind: "artifacts" }} gateway={gateway} />
      </ForceLocale>
    </LocaleProvider>,
  );
  await flush();
});
ok(document.documentElement.lang === "en", "English locale updates the document language");
ok(document.body.textContent?.includes("Artifacts"), "English remains the product fallback");
ok(document.body.textContent?.includes("No artifacts yet"), "English empty states remain available");

await act(async () => {
  root.unmount();
  await flush();
});
if (failed) process.exit(1);
console.log("Northwing product localization tests passed");
