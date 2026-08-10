import { Suspense, useState, useCallback, useEffect } from "react";
import { ArrowRightLeft } from "lucide-react";
import type { NorthwingDestination } from "../Navigation/routes";
import type { ChatWorkDraft } from "./convertChatToWork";
import { useT } from "../../lib/i18n";
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
  const t = useT();
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
        if (!onBeginWork) throw new Error(t("northwing.quickChat.convertUnavailable"));
        onBeginWork(draft);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setConverting(false);
      }
    },
    [sessionTabId, onBeginWork, t],
  );

  return (
    <main className="nw-quick-chat" data-northwing-page="quick-chat" data-session-kind="chat">
      <div className="nw-quick-chat__toolbar">
        <span className="nw-quick-chat__label">{t("northwing.nav.quickChat")}</span>
        <span className="nw-quick-chat__hint">
          {t("northwing.quickChat.hint")}
        </span>
        <button
          type="button"
          className="nw-btn nw-btn--ghost nw-quick-chat__convert"
          onClick={() => void handleConvert()}
          disabled={converting || !sessionTabId}
        >
          <ArrowRightLeft size={14} aria-hidden="true" />
          {converting ? t("northwing.quickChat.preparingWork") : sessionTabId ? t("northwing.quickChat.convert") : t("northwing.quickChat.preparing")}
        </button>
      </div>
      <div className="nw-quick-chat__session">
        {SessionWorkspace ? (
          <Suspense fallback={<p className="nw-quick-chat__placeholder" role="status">{t("northwing.quickChat.preparing")}</p>}>
            <SessionWorkspace destination={destination} onSessionTabReady={handleSessionTabReady} />
          </Suspense>
        ) : (
          <p className="nw-quick-chat__placeholder">{t("northwing.quickChat.empty")}</p>
        )}
      </div>
      {error && <p className="nw-quick-chat__error" role="alert">{error}</p>}
    </main>
  );
}

export default NorthwingQuickChat;
