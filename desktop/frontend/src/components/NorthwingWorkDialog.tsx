import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileOutput, FolderInput, LoaderCircle, Play, X } from "lucide-react";
import { launchCoworkWork, type CoworkProject, type CoworkWorkDraft } from "../lib/northwingCowork";
import "./NorthwingWorkDialog.css";

function lines(value: string): string[] {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function text() {
  const chinese = typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language);
  return chinese ? {
    title: "开始一项 Work",
    subtitle: "Northwing会通过目标模式与交付优先模式持续执行。",
    workTitle: "工作名称",
    objective: "目标",
    materials: "资料",
    deliverable: "交付形式",
    constraints: "限制条件",
    completion: "完成标准",
    titlePlaceholder: "例如：制作研究设计解读报告",
    objectivePlaceholder: "说明最终要完成什么",
    materialsPlaceholder: "每行一个项目内文件路径，例如 sources/protocol.pdf",
    deliverablePlaceholder: "例如：一份可编辑的Word报告和一套PowerPoint",
    constraintsPlaceholder: "例如：中文、面向零基础听众、不得遗漏研究终点",
    completionPlaceholder: "例如：文件可正常打开，内容完整，引用和数字已核对",
    start: "开始工作",
    starting: "正在启动",
    cancel: "取消",
    required: "请填写目标。",
  } : {
    title: "Start a Work",
    subtitle: "Northwing runs it through Goal mode and the Delivery profile.",
    workTitle: "Work title",
    objective: "Goal",
    materials: "Materials",
    deliverable: "Deliverable",
    constraints: "Constraints",
    completion: "Completion criteria",
    titlePlaceholder: "Example: prepare the research design briefing",
    objectivePlaceholder: "Describe the outcome to complete",
    materialsPlaceholder: "One project-relative path per line, for example sources/protocol.pdf",
    deliverablePlaceholder: "Example: an editable Word report and PowerPoint deck",
    constraintsPlaceholder: "Example: Chinese, beginner audience, preserve every endpoint",
    completionPlaceholder: "Example: files open correctly and facts, citations, and figures are checked",
    start: "Start Work",
    starting: "Starting",
    cancel: "Cancel",
    required: "A goal is required.",
  };
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
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [materials, setMaterials] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [constraints, setConstraints] = useState("");
  const [completionCriteria, setCompletionCriteria] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !starting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, starting]);

  const draft = useMemo<CoworkWorkDraft>(() => ({
    title,
    objective,
    materials: lines(materials),
    deliverable,
    constraints,
    completionCriteria,
  }), [completionCriteria, constraints, deliverable, materials, objective, title]);

  const start = async () => {
    if (!objective.trim() || starting) {
      if (!objective.trim()) setError(t.required);
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
          <label>
            <span>{t.workTitle}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
          </label>
          <label className="northwing-work-dialog__wide">
            <span>{t.objective} *</span>
            <textarea autoFocus rows={4} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder={t.objectivePlaceholder} />
          </label>
          <label className="northwing-work-dialog__wide">
            <span><FolderInput size={13} />{t.materials}</span>
            <textarea rows={3} value={materials} onChange={(event) => setMaterials(event.target.value)} placeholder={t.materialsPlaceholder} />
          </label>
          <label>
            <span><FileOutput size={13} />{t.deliverable}</span>
            <textarea rows={3} value={deliverable} onChange={(event) => setDeliverable(event.target.value)} placeholder={t.deliverablePlaceholder} />
          </label>
          <label>
            <span>{t.constraints}</span>
            <textarea rows={3} value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder={t.constraintsPlaceholder} />
          </label>
          <label className="northwing-work-dialog__wide">
            <span>{t.completion}</span>
            <textarea rows={3} value={completionCriteria} onChange={(event) => setCompletionCriteria(event.target.value)} placeholder={t.completionPlaceholder} />
          </label>
        </div>

        {error && <div className="northwing-work-dialog__error">{error}</div>}
        <footer className="northwing-work-dialog__footer">
          <button type="button" className="northwing-work-dialog__secondary" onClick={onClose} disabled={starting}>{t.cancel}</button>
          <button type="button" className="northwing-work-dialog__primary" onClick={() => void start()} disabled={starting || !objective.trim()}>
            {starting ? <LoaderCircle className="northwing-spin" size={15} /> : <Play size={15} />}
            {starting ? t.starting : t.start}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
