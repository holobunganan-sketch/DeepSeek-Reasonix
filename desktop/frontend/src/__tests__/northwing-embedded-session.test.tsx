import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { EmbeddedSessionSurface } from "../components/EmbeddedSessionSurface";

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

function SessionSurfaceProbe({ shellMode }: { shellMode?: string }) {
  return <div data-testid="session-surface" data-shell-mode={shellMode} />;
}

async function run() {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("missing root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(<EmbeddedSessionSurface SessionSurface={SessionSurfaceProbe} />);
  });
  const shellMode = document.querySelector('[data-testid="session-surface"]')?.getAttribute("data-shell-mode");
  if (shellMode !== "embedded") {
    process.stdout.write(`  FAIL  embedded session mode: got ${String(shellMode)}, expected embedded\n`);
    process.exit(1);
  }
  process.stdout.write("  PASS  Northwing owns outer chrome and requests embedded session mode\n");
  await act(async () => root.unmount());
}

void run();
