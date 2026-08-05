import { useEffect, useState } from "react";
import { CircleCheck, MessageSquare, PauseCircle, Play, Sparkles } from "lucide-react";
import { app, onEvent } from "../lib/bridge";
import { getLocale } from "../lib/i18n";
import type { NorthwingLaunch } from "../lib/northwingBridgeAugment";
import { NorthwingOpenCodeSetup } from "./NorthwingOpenCodeSetup";
import { NorthwingProjectCenter, type NorthwingProjectCenterProps } from "./NorthwingProjectCenter";
import "./NorthwingCoworkRail.css";

type SurfaceMode = "chat" | "work";
type LiveState = "idle" | "working" | "waiting" | "done" | "error";
type LaunchBinding = { PendingNorthwingLaunches?: () => Promise<NorthwingLaunch[]> };

const MODE_KEY = "northwing:surface-mode";

function initialMode(): SurfaceMode {
  try { return localStorage.getItem(MODE_KEY) === "chat" ? "chat" : "work"; }
  catch { return "work"; }
}

function text() {
  const zh = ["zh", "zh-TW"].includes(getLocale());
  return zh ? {
    chat: "Chat",
    work: "Work",
    chatHint: "用于快速讨论和分析。当前会话、模型与全部高级能力保持可用。",
    switchWork: "切换到Work交付成品",
    idle: "可开始工作",
    working: "正在执行任务",
    waiting: "等待你的确认",
    done: "本轮工作已完成",
    error: "任务需要处理",
  } : {
    chat: "Chat",
    work: "Work",
    chatHint: "Use the current conversation for quick discussion and analysis. All advanced capabilities remain available.",
    switchWork: "Switch to Work for a deliverable",
    idle: "Ready",
    working: "Working",
    waiting: "Waiting for your decision",
    done: "Turn completed",
    error: "Needs attention",
  };
}

export function NorthwingCoworkRail(props: NorthwingProjectCenterProps) {
  const t = text();
  const [mode, setMode] = useState<SurfaceMode>(initialMode);
  const [live, setLive] = useState<{ state: LiveState; detail: string }>({ state: "idle", detail: "" });

  const choose = (next: SurfaceMode) => {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* unavailable */ }
  };

  useEffect(() => onEvent((event) => {
    switch (event.kind) {
    case "turn_started": setLive({ state: "working", detail: "" }); break;
    case "phase": setLive({ state: "working", detail: event.text?.trim() ?? "" }); break;
    case "approval_request":
    case "ask_request": setLive({ state: "waiting", detail: event.text?.trim() ?? "" }); break;
    case "turn_done": setLive({ state: event.err ? "error" : "done", detail: event.err?.trim() ?? "" }); break;
    default: break;
    }
  }), []);

  useEffect(() => {
    let cancelled = false;
    const binding = app as typeof app & LaunchBinding;
    const consume = async () => {
      if (cancelled || typeof binding.PendingNorthwingLaunches !== "function") return;
      try {
        const launches = await binding.PendingNorthwingLaunches();
        for (const launch of launches) {
          if (cancelled) return;
          choose(launch.mode === "chat" ? "chat" : "work");
          if (launch.workspace) await app.SwitchWorkspace(launch.workspace);
        }
      } catch {
        // Protocol activation is optional and must never disturb normal startup.
      }
    };
    void consume();
    const timer = window.setInterval(() => void consume(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const label = live.state === "working" ? t.working
    : live.state === "waiting" ? t.waiting
    : live.state === "done" ? t.done
    : live.state === "error" ? t.error
    : t.idle;
  const Icon = live.state === "working" ? Play
    : live.state === "waiting" ? PauseCircle
    : live.state === "done" ? CircleCheck
    : Sparkles;

  return (
    <div className="northwing-cowork-rail">
      <div className="northwing-cowork-rail__mode" role="tablist" aria-label="Northwing mode">
        <button type="button" role="tab" aria-selected={mode === "chat"} className={mode === "chat" ? "is-active" : ""} onClick={() => choose("chat")}><MessageSquare size={13} />{t.chat}</button>
        <button type="button" role="tab" aria-selected={mode === "work"} className={mode === "work" ? "is-active" : ""} onClick={() => choose("work")}><Sparkles size={13} />{t.work}</button>
      </div>

      {(live.state !== "idle" || live.detail) && (
        <div className={`northwing-cowork-rail__live is-${live.state}`} aria-live="polite">
          <Icon size={13} /><span><strong>{label}</strong>{live.detail && <small>{live.detail}</small>}</span>
        </div>
      )}

      {mode === "work" ? (
        <><NorthwingOpenCodeSetup /><NorthwingProjectCenter {...props} /></>
      ) : (
        <div className="northwing-cowork-rail__chat"><p>{t.chatHint}</p><button type="button" onClick={() => choose("work")}><Sparkles size={13} />{t.switchWork}</button></div>
      )}
    </div>
  );
}
