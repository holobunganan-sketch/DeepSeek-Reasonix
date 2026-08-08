// Run: tsx src/__tests__/northwing-work-projection-hook.test.tsx
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  useNorthwingWorkProjection,
  type NorthwingWorkProjectionGateway,
} from "../northwing/Work/useNorthwingWorkProjection";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});

let failed = 0;

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    process.stdout.write(`  PASS  ${label}\n`);
    return;
  }
  failed += 1;
  process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function state(workId: string, title: string) {
  return {
    exists: true,
    project: {
      version: 1,
      id: `project-${workId}`,
      name: title,
      createdAt: "2026-08-09T00:00:00Z",
      updatedAt: "2026-08-09T00:00:00Z",
      works: [{
        id: workId,
        title,
        profile: "delivery",
        stage: "reviewing",
        currentHarnessStep: "review",
        acceptance: [],
        unresolvedFindings: [],
        completedCriteria: 0,
        totalCriteria: 0,
      }],
    },
  } as const;
}

const slowA = deferred<ReturnType<typeof state>>();
const slowC = deferred<ReturnType<typeof state>>();
const gateway: NorthwingWorkProjectionGateway = {
  readProjectState: (workspaceRoot) => {
    if (workspaceRoot === "C:/A") return slowA.promise;
    if (workspaceRoot === "C:/C") return slowC.promise;
    return Promise.resolve(state("work-b", "Work B"));
  },
  listTabs: async () => [],
  metaForTab: async () => {
    throw new Error("MetaForTab must not run without a native Work tab");
  },
  activeWorkForTab: async () => {
    throw new Error("ActiveWorkForTab must not run without a native Work tab");
  },
  updateProjection: async () => {
    throw new Error("A projection without runtime evidence must not be persisted");
  },
};

function Probe({ workspaceRoot, workId }: { workspaceRoot: string; workId: string }) {
  const projection = useNorthwingWorkProjection(workspaceRoot, workId, 60_000, gateway);
  return <output data-work-id={projection.work?.id ?? "loading"}>{projection.work?.title ?? "Loading"}</output>;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const container = document.getElementById("root")!;
const root = createRoot(container);

await act(async () => {
  root.render(<Probe workspaceRoot="C:/A" workId="work-a" />);
  await flush();
});
await act(async () => {
  root.render(<Probe workspaceRoot="C:/B" workId="work-b" />);
  await flush();
  await flush();
});
equal(container.querySelector("output")?.getAttribute("data-work-id"), "work-b", "the new Work route loads while the old route is pending");

await act(async () => {
  slowA.resolve(state("work-a", "Work A"));
  await flush();
  await flush();
});
equal(container.querySelector("output")?.getAttribute("data-work-id"), "work-b", "a late old-route refresh cannot replace the current Work");
equal(container.querySelector("output")?.textContent, "Work B", "the current Work title survives the stale refresh");

await act(async () => {
  root.render(<Probe workspaceRoot="C:/C" workId="work-c" />);
  await flush();
});
equal(container.querySelector("output")?.getAttribute("data-work-id"), "loading", "a loaded Work is hidden immediately when the next Work is still loading");
equal(container.querySelector("output")?.textContent, "Loading", "the slow next route cannot flash the previous Work title");

await act(async () => {
  slowC.resolve(state("work-c", "Work C"));
  await flush();
  await flush();
});
equal(container.querySelector("output")?.getAttribute("data-work-id"), "work-c", "the slow next Work appears after its own state loads");

await act(async () => root.unmount());
dom.window.close();

process.stdout.write(`\n${failed === 0 ? "All Northwing Work projection hook tests passed." : `${failed} test(s) FAILED.`}\n`);
process.exit(failed > 0 ? 1 : 0);
