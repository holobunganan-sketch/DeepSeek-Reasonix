import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Brain,
  ChevronDown,
  FileOutput,
  FolderInput,
  Gauge,
  LoaderCircle,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { app } from "../lib/bridge";
import { asArray } from "../lib/array";
import {
  SOURCE_POLICIES,
  WORK_KINDS,
  WORK_QUALITIES,
  normalizeWorkSpec,
  workSpecSummary,
  type SourcePolicy,
  type WorkKind,
  type WorkQuality,
} from "../lib/northwingWorkSpec";
import { launchCoworkWork, type CoworkProject, type CoworkWorkDraft } from "../lib/northwingCowork";
import type { ModelInfo } from "../lib/types";
import "./NorthwingWorkDialog.css";

function lines(value: string): string[] {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function text() {
  const chinese = typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language);
  return chinese ? {
    title: "新建 Work",
    subtitle: "使用 Northwing 原生会话、模型、Goal 与 Delivery 完成交付。",
    objective: "你希望完成什么",
    objectivePlaceholder: "例如：根据项目中的临床研究方案，制作一份面向内部医学团队的中文解读报告和PPT。",
    materials: "资料路径（可选）",
    materialsPlaceholder: "每行一个项目内路径，例如 sources/protocol.pdf",
    kind: "工作类型",
    quality: "交付质量",
    sourcePolicy: "资料策略",
    model: "执行模型",
    currentModel: "使用当前／默认模型",
    noModels: "当前没有可用模型，请先在“设置 → 模型”完成配置。",
    summary: "将按以下方式执行",
    advanced: "高级设置",
    workTitle: "工作名称",
    audience: "受众",
    deliverable: "交付形式",
    constraints: "限制条件",
    completion: "补充完成标准",
    pausePolicy: "暂停策略",
    effort: "推理强度",
    inherit: "继承模型默认值",
    titlePlaceholder: "留空则根据目标自动生成",
    audiencePlaceholder: "例如：内部医学团队、零基础听众",
    deliverablePlaceholder: "留空则根据工作类型自动生成",
    constraintsPlaceholder: "每行一项，例如：中文；不得遗漏主要终点",
    completionPlaceholder: "每行一项，例如：所有数字均已逐项核对",
    pausePlaceholder: "留空则仅在外部操作、范围变化或缺少关键信息时暂停",
    start: "开始 Work",
    starting: "正在启动",
    cancel: "取消",
    required: "请填写工作目标。",
    modelRequired: "没有可用模型。",
    kindLabels: {
      general: "通用任务", research: "研究与证据整理", report: "报告／Word",
      presentation: "演示文稿／PPT", analysis: "数据分析／Excel",
      review: "文档审阅与修改", batch: "文件批处理",
    } satisfies Record<WorkKind, string>,
    qualityLabels: { quick: "快速", standard: "标准", deep: "深度" } satisfies Record<WorkQuality, string>,
    sourceLabels: {
      project_only: "仅使用项目材料",
      project_plus_web: "项目材料为主，可联网补充",
      verified_web: "联网核查并提供引用",
    } satisfies Record<SourcePolicy, string>,
  } : {
    title: "New Work",
    subtitle: "Use a native Northwing session, model, Goal, and Delivery workflow.",
    objective: "What should be completed",
    objectivePlaceholder: "Example: turn the clinical study protocol in this project into an internal medical report and presentation.",
    materials: "Material paths (optional)",
    materialsPlaceholder: "One project-relative path per line, for example sources/protocol.pdf",
    kind: "Work type",
    quality: "Delivery quality",
    sourcePolicy: "Evidence policy",
    model: "Executor model",
    currentModel: "Use the current/default model",
    noModels: "No configured model is available. Configure one in Settings → Model.",
    summary: "Execution summary",
    advanced: "Advanced settings",
    workTitle: "Work title",
    audience: "Audience",
    deliverable: "Deliverable",
    constraints: "Constraints",
    completion: "Additional completion criteria",
    pausePolicy: "Pause policy",
    effort: "Reasoning effort",
    inherit: "Inherit model default",
    titlePlaceholder: "Leave blank to derive it from the goal",
    audiencePlaceholder: "Example: internal medical team or beginner audience",
    deliverablePlaceholder: "Leave blank to use the Work-type default",
    constraintsPlaceholder: "One item per line, for example Chinese; preserve every primary endpoint",
    completionPlaceholder: "One item per line, for example every figure has been checked",
    pausePlaceholder: "Leave blank to pause only for external effects, scope changes, or missing critical information",
    start: "Start Work",
    starting: "Starting",
    cancel: "Cancel",
    required: "A Work goal is required.",
    modelRequired: "No configured model is available.",
    kindLabels: {
      general: "General", research: "Research and evidence", report: "Report / Word",
      presentation: "Presentation / PowerPoint", analysis: "Data analysis / Excel",
      review: "Review and revision", batch: "File batch",
    } satisfies Record<WorkKind, string>,
    qualityLabels: { quick: "Quick", standard: "Standard", deep: "Deep" } satisfies Record<WorkQuality, string>,
    sourceLabels: {
      project_only: "Project materials only",
      project_plus_web: "Project-first with web supplementation",
      verified_web: "Verified web research with citations",
    } satisfies Record<SourcePolicy, string>,
  };
}

function modelLabel(model: ModelInfo): string {
  const provider = String(model.provider ?? "").trim();
  const name = String(model.model ?? model.ref ?? "").trim();
  return provider ? `${name} · ${provider}` : name;
}

export function NorthwingWorkDialog({
  workspaceRoot,
  onClose,
  onStarted,
}: {
  workspaceRoot: string;
  onClose: () => void;
  onStarted: (project: CoworkProject) => void;
}) {
  const t = text();
  const [objective, setObjective] = useState("");
  const [materials, setMaterials] = useState("");
  const [kind, setKind] = useState<WorkKind>("general");
  const [quality, setQuality] = useState<WorkQuality>("standard");
  const [sourcePolicy, setSourcePolicy] = useState<SourcePolicy>("project_only");
  const [modelRef, setModelRef] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [constraints, setConstraints] = useState("");
  const [completionCriteria, setCompletionCriteria] = useState("");
  const [pausePolicy, setPausePolicy] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !starting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, starting]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const catalog = asArray(await app.Models());
        if (cancelled) return;
        setModels(catalog);
        const current = catalog.find((model) => model.current);
        setModelRef((value) => value || current?.ref || "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setCatalogLoaded(true);
      }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("reasonix:model-catalog-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("reasonix:model-catalog-changed", refresh);
    };
  }, []);

  const draft = useMemo<CoworkWorkDraft>(() => ({
    title,
    objective,
    materials: lines(materials),
    kind,
    quality,
    sourcePolicy,
    audience,
    deliverable,
    constraints,
    completionCriteria,
    pausePolicy,
    modelRef,
    reasoningEffort,
  }), [
    audience,
    completionCriteria,
    constraints,
    deliverable,
    kind,
    materials,
    modelRef,
    objective,
    pausePolicy,
    quality,
    reasoningEffort,
    sourcePolicy,
    title,
  ]);

  const summary = useMemo(() => {
    if (!objective.trim()) return [];
    try { return workSpecSummary(normalizeWorkSpec(draft)); }
    catch { return []; }
  }, [draft, objective]);

  const modelAvailable = models.length > 0 && models.some((model) => model.ref === modelRef);

  const start = async () => {
    if (!objective.trim() || starting) {
      if (!objective.trim()) setError(t.required);
      return;
    }
    if (!modelAvailable) {
      setError(t.modelRequired);
      return;
    }
    setStarting(true);
    setError("");
    try {
      const result = await launchCoworkWork(workspaceRoot, draft);
      onStarted(result.project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  return createPortal(
    <div className="northwing-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !starting) onClose();
    }}>
      <section className="northwing-work-dialog" role="dialog" aria-modal="true" aria-labelledby="northwing-work-dialog-title">
        <header className="northwing-work-dialog__header">
          <div>
            <h2 id="northwing-work-dialog-title">{t.title}</h2>
            <p>{t.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={starting} aria-label={t.cancel}><X size={17} /></button>
        </header>

        <div className="northwing-work-dialog__form">
          <label className="northwing-work-dialog__wide">
            <span>{t.objective} *</span>
            <textarea autoFocus rows={4} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder={t.objectivePlaceholder} />
          </label>

          <label>
            <span><FileOutput size={13} />{t.kind}</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as WorkKind)}>
              {WORK_KINDS.map((value) => <option key={value} value={value}>{t.kindLabels[value]}</option>)}
            </select>
          </label>
          <label>
            <span><Gauge size={13} />{t.quality}</span>
            <select value={quality} onChange={(event) => setQuality(event.target.value as WorkQuality)}>
              {WORK_QUALITIES.map((value) => <option key={value} value={value}>{t.qualityLabels[value]}</option>)}
            </select>
          </label>
          <label>
            <span><ShieldCheck size={13} />{t.sourcePolicy}</span>
            <select value={sourcePolicy} onChange={(event) => setSourcePolicy(event.target.value as SourcePolicy)}>
              {SOURCE_POLICIES.map((value) => <option key={value} value={value}>{t.sourceLabels[value]}</option>)}
            </select>
          </label>
          <label>
            <span><Brain size={13} />{t.model}</span>
            <select value={modelRef} onChange={(event) => setModelRef(event.target.value)} disabled={!catalogLoaded || models.length === 0}>
              {models.length === 0 && <option value="">{catalogLoaded ? t.noModels : t.currentModel}</option>}
              {models.map((model) => <option key={model.ref} value={model.ref}>{modelLabel(model)}</option>)}
            </select>
          </label>

          <label className="northwing-work-dialog__wide">
            <span><FolderInput size={13} />{t.materials}</span>
            <textarea rows={3} value={materials} onChange={(event) => setMaterials(event.target.value)} placeholder={t.materialsPlaceholder} />
          </label>

          {summary.length > 0 && (
            <section className="northwing-work-dialog__summary" aria-label={t.summary}>
              <strong>{t.summary}</strong>
              <ul>{summary.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}

          <details className="northwing-work-dialog__advanced northwing-work-dialog__wide">
            <summary><ChevronDown size={14} />{t.advanced}</summary>
            <div className="northwing-work-dialog__advanced-grid">
              <label>
                <span>{t.workTitle}</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
              </label>
              <label>
                <span>{t.audience}</span>
                <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder={t.audiencePlaceholder} />
              </label>
              <label className="northwing-work-dialog__wide">
                <span>{t.deliverable}</span>
                <textarea rows={3} value={deliverable} onChange={(event) => setDeliverable(event.target.value)} placeholder={t.deliverablePlaceholder} />
              </label>
              <label>
                <span>{t.constraints}</span>
                <textarea rows={4} value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder={t.constraintsPlaceholder} />
              </label>
              <label>
                <span>{t.completion}</span>
                <textarea rows={4} value={completionCriteria} onChange={(event) => setCompletionCriteria(event.target.value)} placeholder={t.completionPlaceholder} />
              </label>
              <label className="northwing-work-dialog__wide">
                <span>{t.pausePolicy}</span>
                <textarea rows={3} value={pausePolicy} onChange={(event) => setPausePolicy(event.target.value)} placeholder={t.pausePlaceholder} />
              </label>
              <label>
                <span>{t.effort}</span>
                <select value={reasoningEffort} onChange={(event) => setReasoningEffort(event.target.value)}>
                  <option value="">{t.inherit}</option>
                  <option value="auto">auto</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
            </div>
          </details>
        </div>

        {error && <div className="northwing-work-dialog__error">{error}</div>}
        <footer className="northwing-work-dialog__footer">
          <button type="button" className="northwing-work-dialog__secondary" onClick={onClose} disabled={starting}>{t.cancel}</button>
          <button type="button" className="northwing-work-dialog__primary" onClick={() => void start()} disabled={starting || !objective.trim() || !modelAvailable}>
            {starting ? <LoaderCircle className="northwing-spin" size={15} /> : <Play size={15} />}
            {starting ? t.starting : t.start}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
