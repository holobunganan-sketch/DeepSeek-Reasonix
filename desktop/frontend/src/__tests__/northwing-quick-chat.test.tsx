// Run: node --import tsx --import ./scripts/register-css-test-loader.mjs src/__tests__/northwing-quick-chat.test.tsx
// Break caught: Quick Chat must remain a chat-only semantic session surface.
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { NorthwingQuickChat } from "../northwing/QuickChat/NorthwingQuickChat";
import type { NorthwingDestination } from "../northwing/Navigation/routes";

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

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function SessionWorkspaceStub({ destination }: { destination: NorthwingDestination }) {
  return <section data-testid="chat-session" data-tab-id={destination.kind === "quick-chat" ? destination.tabId : undefined}>Transcript</section>;
}

const rootNode = document.getElementById("root");
if (!rootNode) throw new Error("missing test root");
const root = createRoot(rootNode);
await act(async () => {
  root.render(<NorthwingQuickChat tabId="chat-7" SessionWorkspace={SessionWorkspaceStub} />);
});

console.log("\nNorthwing Quick Chat behavior");
const main = document.querySelector('main[data-session-kind="chat"]');
ok(main, "Quick Chat exposes a semantic chat main region");
ok(document.querySelector('[data-testid="chat-session"]')?.getAttribute("data-tab-id") === "chat-7", "Quick Chat keeps its SessionWorkspace tab");
for (const forbidden of ["Acceptance", "Artifacts", "Versions", "Final Work"]) {
  ok(!document.body.textContent?.includes(forbidden), `Quick Chat omits the Work-only ${forbidden} region`);
}

await act(async () => root.unmount());
process.stdout.write(`\n${failed === 0 ? "Northwing Quick Chat tests passed." : `${failed} test(s) FAILED.`}\n`);
process.exit(failed > 0 ? 1 : 0);
