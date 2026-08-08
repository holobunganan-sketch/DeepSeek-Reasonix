import { Suspense, useState, useCallback } from "react";
import { ArrowRightLeft } from "lucide-react";
import type { NorthwingDestination } from "../Navigation/routes";
import { NorthwingConvertToWorkDialog } from "./NorthwingConvertToWorkDialog";
import "./NorthwingQuickChat.css";

export type NorthwingQuickChatProps = {
  workspaceRoot?: string;
  tabId?: string;
  SessionWorkspace?: React.ComponentType<{ destination: NorthwingDestination }>;
  onConvertToWork?: (workspaceRoot: string, workId: string) => void;
  onNavigate?: (destination: NorthwingDestination) => void;
};

export function NorthwingQuickChat({
  workspaceRoot,
  tabId,
  SessionWorkspace,
  onConvertToWork,
  onNavigate,
}: NorthwingQuickChatProps) {
  const [showConvert, setShowConvert] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const destination: NorthwingDestination = { kind: "quick-chat", tabId };

  const handleConvertConfirm = useCallback(
    async (objective: string) => {
      setConverting(true);
      setError(undefined);
      try {
        const { convertChatToWork } = await import("./convertChatToWork");
        const result = await convertChatToWork(
          workspaceRoot ?? "",
          objective,
          tabId,
        );
        setShowConvert(false);
        onConvertToWork?.(workspaceRoot ?? "", result.workId);
        onNavigate?.({ kind: "work", workspaceRoot: workspaceRoot ?? "", workId: result.workId });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setConverting(false);
      }
    },
    [workspaceRoot, tabId, onConvertToWork, onNavigate],
  );

  return (
    <div className="nw-quick-chat" data-northwing-page="quick-chat">
      <div className="nw-quick-chat__toolbar">
        <span className="nw-quick-chat__label">Quick Chat</span>
        <span className="nw-quick-chat__hint">
          Fast answers and exploration. For structured delivery, use Work.
        </span>
        <button
          type="button"
          className="nw-btn nw-btn--ghost nw-quick-chat__convert"
          onClick={() => setShowConvert(true)}
        >
          <ArrowRightLeft size={14} aria-hidden="true" />
          Convert to Work
        </button>
      </div>
      <div className="nw-quick-chat__session">
        {SessionWorkspace ? (
          <Suspense fallback={<p className="nw-quick-chat__placeholder" role="status">Preparing Quick Chat...</p>}>
            <SessionWorkspace destination={destination} />
          </Suspense>
        ) : (
          <p className="nw-quick-chat__placeholder">Start a quick chat to explore ideas or ask questions.</p>
        )}
      </div>
      {showConvert && (
        <NorthwingConvertToWorkDialog
          submitting={converting}
          error={error}
          onConfirm={handleConvertConfirm}
          onCancel={() => { setShowConvert(false); setError(undefined); }}
        />
      )}
    </div>
  );
}

export default NorthwingQuickChat;
