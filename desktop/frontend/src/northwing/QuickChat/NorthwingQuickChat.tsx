import { Suspense, useState, useCallback, useEffect } from "react";
import { ArrowRightLeft } from "lucide-react";
import type { NorthwingDestination } from "../Navigation/routes";
import type { ChatWorkDraft } from "./convertChatToWork";
import "./NorthwingQuickChat.css";

export type NorthwingQuickChatProps = {
  tabId?: string;
  SessionWorkspace?: React.ComponentType<{ destination: NorthwingDestination; onSessionTabReady?: (tabId: string) => void }>;
  onBeginWork?: (draft: ChatWorkDraft) => void;
  onSessionTabReady?: (tabId: string) => void;
};

export function NorthwingQuickChat({
  tabId,
  SessionWorkspace,
  onBeginWork,
  onSessionTabReady,
}: NorthwingQuickChatProps) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sessionTabId, setSessionTabId] = useState(tabId);

  useEffect(() => {
    setSessionTabId(tabId);
  }, [tabId]);

  const destination: NorthwingDestination = { kind: "quick-chat", tabId: sessionTabId };

  const handleSessionTabReady = useCallback((readyTabId: string) => {
    setSessionTabId(readyTabId);
    onSessionTabReady?.(readyTabId);
  }, [onSessionTabReady]);

  const handleConvert = useCallback(
    async () => {
      if (!sessionTabId) return;
      setConverting(true);
      setError(undefined);
      try {
        const { readChatWorkDraft } = await import("./convertChatToWork");
        const draft = await readChatWorkDraft(sessionTabId);
        if (!onBeginWork) throw new Error("Quick Chat conversion is unavailable.");
        onBeginWork(draft);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setConverting(false);
      }
    },
    [sessionTabId, onBeginWork],
  );

  return (
    <main className="nw-quick-chat" data-northwing-page="quick-chat" data-session-kind="chat">
      <div className="nw-quick-chat__toolbar">
        <span className="nw-quick-chat__label">Quick Chat</span>
        <span className="nw-quick-chat__hint">
          Fast answers and exploration. For structured delivery, use Work.
        </span>
        <button
          type="button"
          className="nw-btn nw-btn--ghost nw-quick-chat__convert"
          onClick={() => void handleConvert()}
          disabled={converting || !sessionTabId}
        >
          <ArrowRightLeft size={14} aria-hidden="true" />
          {converting ? "Preparing Work..." : sessionTabId ? "Convert to Work" : "Preparing Quick Chat..."}
        </button>
      </div>
      <div className="nw-quick-chat__session">
        {SessionWorkspace ? (
          <Suspense fallback={<p className="nw-quick-chat__placeholder" role="status">Preparing Quick Chat...</p>}>
            <SessionWorkspace destination={destination} onSessionTabReady={handleSessionTabReady} />
          </Suspense>
        ) : (
          <p className="nw-quick-chat__placeholder">Start a quick chat to explore ideas or ask questions.</p>
        )}
      </div>
      {error && <p className="nw-quick-chat__error" role="alert">{error}</p>}
    </main>
  );
}

export default NorthwingQuickChat;
