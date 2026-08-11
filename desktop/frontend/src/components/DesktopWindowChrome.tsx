import { useCallback, useEffect, useRef, useState } from "react";
import { Copy as RestoreIcon, Minus, Square, X } from "lucide-react";
import { app, type AppBindings } from "../lib/bridge";
import { useT } from "../lib/i18n";

export type DesktopWindowBridge = Pick<
  AppBindings,
  "MinimiseMainWindow" | "ToggleMaximiseMainWindow" | "IsMainWindowMaximised" | "CloseMainWindow"
>;

export type DesktopWindowChromeController = {
  maximised: boolean;
  minimise: () => void;
  toggleMaximise: () => void;
  close: () => void;
  syncMaximised: () => void;
};

export function useDesktopWindowChrome(
  enabled: boolean,
  bridge: DesktopWindowBridge = app,
): DesktopWindowChromeController {
  const [maximised, setMaximised] = useState(false);
  const syncGenerationRef = useRef(0);

  const syncMaximised = useCallback(() => {
    if (!enabled) return;
    const generation = ++syncGenerationRef.current;
    void bridge.IsMainWindowMaximised()
      .then((value) => {
        if (generation === syncGenerationRef.current) setMaximised(value);
      })
      .catch(() => {
        if (generation === syncGenerationRef.current) setMaximised(false);
      });
  }, [bridge, enabled]);

  useEffect(() => {
    if (!enabled) {
      syncGenerationRef.current += 1;
      setMaximised(false);
      return;
    }
    syncMaximised();
    window.addEventListener("resize", syncMaximised);
    window.addEventListener("focus", syncMaximised);
    return () => {
      syncGenerationRef.current += 1;
      window.removeEventListener("resize", syncMaximised);
      window.removeEventListener("focus", syncMaximised);
    };
  }, [enabled, syncMaximised]);

  const minimise = useCallback(() => {
    void bridge.MinimiseMainWindow();
  }, [bridge]);

  const toggleMaximise = useCallback(() => {
    void bridge.ToggleMaximiseMainWindow()
      .then(() => window.setTimeout(syncMaximised, 80))
      .catch(() => undefined);
  }, [bridge, syncMaximised]);

  const close = useCallback(() => {
    void bridge.CloseMainWindow();
  }, [bridge]);

  return { maximised, minimise, toggleMaximise, close, syncMaximised };
}

export function DesktopWindowControls({ controller }: { controller: DesktopWindowChromeController }) {
  const t = useT();
  return (
    <div className="windows-window-controls" aria-label={t("northwing.window.controls")}>
      <button
        className="windows-window-control windows-window-control--minimize"
        type="button"
        aria-label={t("northwing.window.minimize")}
        title={t("northwing.window.minimizeTitle")}
        onClick={controller.minimise}
      >
        <Minus size={13} strokeWidth={1.9} />
      </button>
      <button
        className="windows-window-control windows-window-control--maximize"
        type="button"
        aria-label={t("northwing.window.maximizeRestore")}
        aria-pressed={controller.maximised}
        title={controller.maximised ? t("northwing.window.restoreTitle") : t("northwing.window.maximizeTitle")}
        onClick={controller.toggleMaximise}
      >
        {controller.maximised ? <RestoreIcon size={12} strokeWidth={1.75} /> : <Square size={11} strokeWidth={1.8} />}
      </button>
      <button
        className="windows-window-control windows-window-control--close"
        type="button"
        aria-label={t("northwing.window.close")}
        title={t("common.close")}
        onClick={controller.close}
      >
        <X size={13} strokeWidth={1.9} />
      </button>
    </div>
  );
}
