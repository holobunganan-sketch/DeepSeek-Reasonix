import { app } from "../../lib/bridge";
import { northwingProjectWorkspaceRoots } from "../entryGateway";
import type { HistoryMessage, ProjectNode, TabMeta } from "../../lib/types";

export type ChatWorkDraft = {
  chatTabId: string;
  title: string;
  objective: string;
  workspaceRoots: string[];
};

export type ChatConversionGateway = {
  listTabs: () => Promise<TabMeta[]>;
  historyForTab: (tabId: string) => Promise<HistoryMessage[]>;
  listProjectTree: () => Promise<ProjectNode[]>;
};

const desktopGateway: ChatConversionGateway = {
  listTabs: () => app.ListTabs(),
  historyForTab: (tabId) => app.HistoryForTab(tabId),
  listProjectTree: () => app.ListProjectTree(),
};

function chatTabForConversion(tabs: TabMeta[], requestedTabId?: string): TabMeta {
  const tab = requestedTabId ? tabs.find((candidate) => candidate.id === requestedTabId) : undefined;
  if (!tab || tab.sessionKind !== "chat") {
    throw new Error("Quick Chat session is unavailable for conversion.");
  }
  return tab;
}

export function deriveWorkDraftFromChat(
  messages: HistoryMessage[],
  topicTitle: string,
  chatTabId: string,
): ChatWorkDraft {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
  if (userMessages.length === 0) {
    throw new Error("Quick Chat has no user messages to convert.");
  }
  const title = topicTitle.trim() || userMessages[0].split(/\r?\n/, 1)[0].slice(0, 80) || "Quick Chat Work";
  return {
    chatTabId,
    title,
    objective: userMessages.join("\n\n"),
    workspaceRoots: [],
  };
}

// Conversion only reads the source chat. Work creation remains owned by the
// New Work controller after the user confirms its prefilled draft.
export async function readChatWorkDraft(
  chatTabId?: string,
  gateway: ChatConversionGateway = desktopGateway,
): Promise<ChatWorkDraft> {
  const tabs = await gateway.listTabs();
  const chatTab = chatTabForConversion(tabs, chatTabId);
  const [history, projectTree] = await Promise.all([
    gateway.historyForTab(chatTab.id),
    gateway.listProjectTree(),
  ]);
  return {
    ...deriveWorkDraftFromChat(history, chatTab.topicTitle, chatTab.id),
    workspaceRoots: northwingProjectWorkspaceRoots(projectTree),
  };
}
