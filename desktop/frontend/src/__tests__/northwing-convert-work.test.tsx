// Run: node --import tsx --import ./scripts/register-css-test-loader.mjs src/__tests__/northwing-convert-work.test.tsx
// Break caught: conversion must prepare a separate Work draft, then create it
// only after the user selects a project and confirms New Work.
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { NorthwingShell, type NorthwingDestination } from "../northwing/Shell/NorthwingShell";
import { readChatWorkDraft } from "../northwing/QuickChat/convertChatToWork";
import { LocaleProvider } from "../lib/i18n";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: "http://localhost/" });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
// React's legacy input-event fallback probes these IE methods in JSDOM when
// the current dialog autofocuses its textarea.
(dom.window.HTMLElement.prototype as HTMLElement & { attachEvent?: () => void }).attachEvent = () => {};
(dom.window.HTMLElement.prototype as HTMLElement & { detachEvent?: () => void }).detachEvent = () => {};

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else { failed += 1; process.stdout.write(`  FAIL  ${label}\n`); }
}
function equal(actual: string | null | undefined, expected: string, label: string) {
  if (actual === expected) process.stdout.write(`  PASS  ${label}\n`);
  else { failed += 1; process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`); }
}
function count(values: string[], expected: string, label: string) {
  const actual = values.filter((value) => value === expected).length;
  if (actual === 1) process.stdout.write(`  PASS  ${label}\n`);
  else { failed += 1; process.stdout.write(`  FAIL  ${label}: got ${actual}, expected 1\n`); }
}
function click(element: Element | null) { if (element) element.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function change(element: HTMLSelectElement, value: string) { element.value = value; element.dispatchEvent(new window.Event("change", { bubbles: true })); }
function flush() { return new Promise((resolve) => setTimeout(resolve, 30)); }

const chatTab = { id: "chat-7", scope: "global", workspaceRoot: "", workspaceName: "Quick Chat", topicId: "topic-launch", topicTitle: "Launch discussion", sessionKind: "chat", label: "Launch discussion", ready: true, running: false, mode: "normal", active: true, cwd: "" };
const oldActiveChatTab = { ...chatTab, id: "chat-old", topicId: "topic-old", topicTitle: "Old active chat", label: "Old active chat" };
const newChatTab = { ...chatTab, id: "chat-new", topicId: "topic-new", topicTitle: "New chat", label: "New chat", active: false };
const history = [
  { role: "user", content: "Decide the launch sequence." },
  { role: "assistant", content: "Assistant-only analysis must not become the Work objective." },
  { role: "tool", content: "tool output must not become the Work objective" },
  { role: "user", content: "Prepare the launch checklist." },
];
const originalTab = JSON.stringify(chatTab);
const originalHistory = JSON.stringify(history);
const creationCalls: string[] = [];
const chatMutations: string[] = [];
const navigations: NorthwingDestination[] = [];
let tabs = [chatTab];
let historyCalls: string[] = [];

(window as typeof window & { go?: { main?: { App?: Record<string, unknown> } } }).go = { main: { App: {
  ListTabs: async () => tabs,
  ListProjectTree: async () => [{ key: "project-team", kind: "project", label: "Team project", root: "C:/team-project" }],
  HistoryForTab: async (tabId: string) => { historyCalls.push(tabId); return tabId === newChatTab.id ? [{ role: "user", content: "Create the new chat work." }] : history; },
  SwitchWorkspace: async (workspaceRoot: string) => workspaceRoot,
  CoworkProjectState: async () => ({ exists: true, project: { version: 3, id: "project-team", name: "Team project", createdAt: "2026-08-10T00:00:00Z", updatedAt: "2026-08-10T00:00:00Z" } }),
  ValidateCoworkProjectWritable: async () => {},
  Models: async () => [{ ref: "deepseek/reasoner", provider: "deepseek", model: "reasoner", current: true }],
  EnsureWorkTab: async (_workspaceRoot: string, workId: string) => { creationCalls.push(`ensure:${workId}`); return { ...chatTab, id: `work-tab-${workId}`, topicId: `work-topic-${workId}`, sessionKind: "work", workId }; },
  MetaForTab: async () => ({ sessionPath: "/sessions/work.jsonl" }),
  RenameTopic: async (topicId: string) => { if (topicId === chatTab.topicId) chatMutations.push("rename-chat-topic"); else creationCalls.push("rename-work-topic"); },
  SetModelForTab: async () => { creationCalls.push("set-model"); },
  SetTokenModeForTab: async () => { creationCalls.push("token-mode"); },
  UpsertCoworkWork: async () => { creationCalls.push("upsert"); return {}; },
  WorkbenchActiveTarget: async () => ({ kind: "local", identityGen: 1, requestSeq: 1 }),
  SubmitInitialGoalToTab: async () => { creationCalls.push("submit"); return []; },
  SetActiveTab: async () => { creationCalls.push("activate"); },
  CloseTab: async (tabId: string) => { if (tabId === chatTab.id) chatMutations.push("close-chat-tab"); },
  SetSessionIdentity: async () => { chatMutations.push("rebind-chat-session"); },
  SubmitDisplayToTab: async (tabId: string) => { if (tabId === chatTab.id) chatMutations.push("write-chat-transcript"); },
} } };

function SessionWorkspaceStub({ destination, onSessionTabReady }: { destination: NorthwingDestination; onSessionTabReady?: (tabId: string) => void }) {
  return <section data-testid="session" data-kind={destination.kind}>
    Chat transcript
    {destination.kind === "quick-chat" && !destination.tabId && (
      <button type="button" onClick={() => onSessionTabReady?.(newChatTab.id)}>Bind current chat</button>
    )}
  </section>;
}

const rootNode = document.getElementById("root");
if (!rootNode) throw new Error("missing test root");
const root = createRoot(rootNode);
await act(async () => {
  root.render(<LocaleProvider><NorthwingShell initialDestination={{ kind: "quick-chat", tabId: "chat-7" }} gateway={{ workspaceRoots: ["C:/team-project"], SessionWorkspace: SessionWorkspaceStub, onNavigate: (destination) => navigations.push(destination) }} /></LocaleProvider>);
  await flush();
});

console.log("\nNorthwing Convert Quick Chat to Work");
await act(async () => { click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Convert to Work")) ?? null); await flush(); });

const title = document.querySelector<HTMLInputElement>('input[aria-label="Work title"]');
const objective = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Work objective"]');
const workspace = document.querySelector<HTMLSelectElement>('select[aria-label="Project workspace"]');
ok(title, "conversion opens a confirmation form with a Work title");
equal(title?.value, "Launch discussion", "native chat topic title pre-fills the independent Work title");
ok(objective?.value.includes("Decide the launch sequence."), "user transcript pre-fills the Work objective");
ok(objective?.value.includes("Prepare the launch checklist."), "later user transcript pre-fills the Work objective");
ok(!objective?.value.includes("Assistant-only analysis"), "assistant transcript content is excluded from the Work objective");
ok(!objective?.value.includes("tool output"), "tool transcript content is excluded from the Work objective");
ok(workspace, "conversion requires a project workspace selection");
ok(creationCalls.length === 0, "opening confirmation does not create or bind Work");

await act(async () => { click(Array.from(document.querySelectorAll("a")).find((link) => link.textContent?.trim() === "Home") ?? null); await flush(); });
await act(async () => { click(document.querySelector('button[aria-label="New Work"]')); await flush(); });
const ordinaryTitle = document.querySelector<HTMLInputElement>('input[aria-label="Work title"]');
const ordinaryObjective = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Work objective"]');
equal(ordinaryTitle?.value, "", "leaving a conversion confirmation clears its chat title before ordinary New Work");
equal(ordinaryObjective?.value, "", "leaving a conversion confirmation clears its chat objective before ordinary New Work");
await act(async () => { click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Cancel") ?? null); await flush(); });
ok(!navigations.some((destination) => destination.kind === "quick-chat" && destination.tabId === chatTab.id), "ordinary New Work cancellation does not reuse an abandoned chat return context");

await act(async () => {
  root.render(<LocaleProvider><NorthwingShell initialDestination={{ kind: "quick-chat", tabId: "chat-7" }} gateway={{ workspaceRoots: ["C:/team-project"], SessionWorkspace: SessionWorkspaceStub, onNavigate: (destination) => navigations.push(destination) }} /></LocaleProvider>);
  await flush();
});
await act(async () => { click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Convert to Work")) ?? null); await flush(); });
await act(async () => { click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Cancel") ?? null); await flush(); });
ok(creationCalls.length === 0, "cancelling conversion leaves Work creation untouched");
equal(JSON.stringify(chatTab), originalTab, "cancelling conversion leaves the original chat tab unchanged");
equal(JSON.stringify(history), originalHistory, "cancelling conversion leaves the original transcript unchanged");

await act(async () => { click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Convert to Work")) ?? null); await flush(); });
const confirmWorkspace = document.querySelector<HTMLSelectElement>('select[aria-label="Project workspace"]');
if (confirmWorkspace) {
  await act(async () => { change(confirmWorkspace, "C:/team-project"); click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Start Work") ?? null); await flush(); });
}
ok(creationCalls.some((call) => call.startsWith("ensure:")), "confirmed conversion creates a fresh native Work tab");
ok(creationCalls.includes("upsert") && creationCalls.includes("submit"), "confirmed conversion uses the New Work persistence and submission chain");
equal(String(creationCalls.filter((call) => call === "upsert").length), "2", "one confirmation persists before and refreshes after submission");
count(creationCalls, "submit", "one confirmation submits one new Work goal");
ok(navigations.some((destination) => destination.kind === "work"), "confirmed conversion navigates to the new Work workspace");
equal(JSON.stringify(chatTab), originalTab, "confirmed conversion keeps the original chat tab unchanged");
equal(JSON.stringify(history), originalHistory, "confirmed conversion keeps the original transcript unchanged");
ok(chatMutations.length === 0, "conversion never closes, rebinds, renames, or writes the original chat");

tabs = [oldActiveChatTab, newChatTab];
historyCalls = [];
await act(async () => {
  root.render(<LocaleProvider><NorthwingShell initialDestination={{ kind: "quick-chat" }} gateway={{ workspaceRoots: ["C:/team-project"], SessionWorkspace: SessionWorkspaceStub, onNavigate: (destination) => navigations.push(destination) }} /></LocaleProvider>);
  await flush();
});
const unboundConvert = document.querySelector<HTMLButtonElement>("button.nw-quick-chat__convert");
ok(unboundConvert instanceof HTMLButtonElement && unboundConvert.disabled, "a new Quick Chat cannot convert before its native tab identity is ready");
await act(async () => { click(unboundConvert ?? null); await flush(); });
ok(historyCalls.length === 0, "an unbound Quick Chat never reads an older active chat transcript");
await act(async () => { click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Bind current chat")) ?? null); await flush(); });
const boundConvert = document.querySelector<HTMLButtonElement>("button.nw-quick-chat__convert");
ok(boundConvert instanceof HTMLButtonElement && !boundConvert.disabled, "the current Quick Chat becomes convertible after its exact native tab is ready");
await act(async () => { click(boundConvert ?? null); await flush(); });
equal(document.querySelector<HTMLInputElement>('input[aria-label="Work title"]')?.value, "New chat", "conversion reads the newly bound chat title, not the previous active chat");
ok(historyCalls.every((tabId) => tabId === newChatTab.id), "conversion reads only the newly bound chat history");

let unboundChatError = "";
try {
  await readChatWorkDraft(undefined, {
    listTabs: async () => [oldActiveChatTab],
    historyForTab: async () => history,
    listProjectTree: async () => [],
  });
} catch (error) {
  unboundChatError = error instanceof Error ? error.message : String(error);
}
equal(unboundChatError, "Quick Chat session is unavailable for conversion.", "draft loading never falls back to another active chat when no tab id is supplied");

let invalidChatError = "";
try {
  await readChatWorkDraft("work-tab", {
    listTabs: async () => [{ ...chatTab, id: "work-tab", sessionKind: "work", workId: "work-9" }],
    historyForTab: async () => history,
    listProjectTree: async () => [],
  });
} catch (error) {
  invalidChatError = error instanceof Error ? error.message : String(error);
}
equal(invalidChatError, "Quick Chat session is unavailable for conversion.", "a non-chat tab fails visibly before any Work creation");

await act(async () => root.unmount());
process.stdout.write(`\n${failed === 0 ? "Northwing Convert to Work tests passed." : `${failed} test(s) FAILED.`}\n`);
process.exit(failed > 0 ? 1 : 0);
