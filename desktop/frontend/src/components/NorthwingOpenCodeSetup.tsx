import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, Settings2 } from "lucide-react";
import { app } from "../lib/bridge";
import { asArray } from "../lib/array";
import { getLocale } from "../lib/i18n";
import type { ProviderPresetView, SettingsView } from "../lib/types";
import "./NorthwingOpenCodeSetup.css";

const GO_PRESETS = ["opencode-go", "opencode-go-anthropic"] as const;
const EXECUTOR_MODEL = "opencode-go/deepseek-v4-flash";
const PLANNER_MODEL = "opencode-go/deepseek-v4-pro";
const SUBAGENT_MODEL = "opencode-go-anthropic/qwen3.7-plus";

function copy() {
  const zh = ["zh", "zh-TW"].includes(getLocale());
  return zh ? {
    title: "OpenCode Go",
    description: "Northwing默认模型服务。Go承担主力执行，Zen保持可选；不会移除其他Provider。",
    key: "OpenCode Go API Key",
    setup: "一键配置",
    settingUp: "正在配置",
    ready: "已配置",
    roles: "执行：V4 Flash · 规划/审查：V4 Pro · 子任务：Qwen 3.7 Plus",
    conflict: "检测到已修改或同名Provider。保留现有配置，请在模型设置中处理。",
    unavailable: "当前版本未提供OpenCode Go预设。",
  } : {
    title: "OpenCode Go",
    description: "Northwing's default model service. Go is primary and Zen remains optional. Other providers are preserved.",
    key: "OpenCode Go API Key",
    setup: "Set up",
    settingUp: "Setting up",
    ready: "Configured",
    roles: "Execute: V4 Flash · Plan/review: V4 Pro · Subtasks: Qwen 3.7 Plus",
    conflict: "A modified or name-conflicting provider was found. Existing configuration was preserved; resolve it in Model settings.",
    unavailable: "OpenCode Go presets are unavailable in this build.",
  };
}

function presetByID(settings: SettingsView | null, id: string): ProviderPresetView | undefined {
  return asArray(settings?.providerPresets).find((preset) => preset.id === id);
}

export function NorthwingOpenCodeSetup() {
  const t = copy();
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    try { setSettings(await app.Settings()); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };
  useEffect(() => { void reload(); }, []);

  const presets = useMemo(() => GO_PRESETS.map((id) => presetByID(settings, id)), [settings]);
  const available = presets.every(Boolean);
  const conflicts = presets.some((preset) => preset?.status === "name_conflict" || preset?.status === "installed_modified");
  const installed = presets.every((preset) => preset?.status === "installed" || preset?.status === "installed_modified");
  const keySet = presets.every((preset) => Boolean(preset?.keySet));
  const configured = installed && keySet && settings?.defaultModel === EXECUTOR_MODEL;

  const setup = async () => {
    if (busy || !available || conflicts) return;
    setBusy(true);
    setError("");
    try {
      const enteredKey = key.trim();
      for (const preset of presets) {
        if (!preset) continue;
        if (preset.status === "installed") {
          if (!preset.keySet && enteredKey) await app.SetProviderKey(preset.keyEnv, enteredKey);
          continue;
        }
        await app.AddProviderPresetAccess(preset.id, enteredKey);
      }
      await app.SetDefaultModel(EXECUTOR_MODEL);
      await app.SetPlannerModel(PLANNER_MODEL);
      await app.SetSubagentModel(SUBAGENT_MODEL);
      setKey("");
      await reload();
      window.dispatchEvent(new Event("reasonix:model-catalog-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return null;
  return (
    <section className={`northwing-opencode${configured ? " is-ready" : ""}`}>
      <div className="northwing-opencode__head">
        <span className="northwing-opencode__icon">{configured ? <CheckCircle2 size={15} /> : <Settings2 size={15} />}</span>
        <span><strong>{t.title}</strong><small>{t.description}</small></span>
      </div>
      <div className="northwing-opencode__roles">{t.roles}</div>
      {!configured && available && !conflicts && (
        <div className="northwing-opencode__form">
          {!keySet && <label><KeyRound size={13} /><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder={t.key} autoComplete="off" /></label>}
          <button type="button" disabled={busy || (!keySet && !key.trim())} onClick={() => void setup()}>
            {busy ? <LoaderCircle className="northwing-spin" size={13} /> : <Settings2 size={13} />}
            {busy ? t.settingUp : t.setup}
          </button>
        </div>
      )}
      {configured && <div className="northwing-opencode__ready"><CheckCircle2 size={12} />{t.ready}</div>}
      {!available && <div className="northwing-opencode__error">{t.unavailable}</div>}
      {conflicts && <div className="northwing-opencode__error">{t.conflict}</div>}
      {error && <div className="northwing-opencode__error">{error}</div>}
    </section>
  );
}
