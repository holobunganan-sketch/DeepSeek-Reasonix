import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ExternalLink,
  FileOutput,
  FolderSearch,
  LoaderCircle,
  MessageSquareText,
  Play,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import {
  continueCoworkWork,
  openCoworkArtifact,
  previewCoworkArtifact,
  readCoworkProjectState,
  revealCoworkArtifact,
  reviseCoworkArtifact,
  setCoworkArtifactFinal,
  type CoworkArtifact,
  type CoworkProjectState,
  type CoworkWorkRef,
} from "../lib/northwingCowork";
import type { FilePreview } from "../lib/types";
import "./NorthwingArtifactCenter.css";

function localText() {
  const chinese = typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language);
  return chinese ? {
    title: "项目工作与成品",
    works: "工作",
    artifacts: "成品",
    noWorks: "还没有Work。",
    noArtifacts: "尚未发现成品。任务完成后，deliverables目录中的文件会自动登记。",
    continue: "继续",
    sync: "同步成品",
    syncing: "正在同步",
    preview: "预览",
    open: "打开",
    reveal: "定位",
    final: "设为最终版",
    finalBadge: "最终版",
    revise: "修改",
    revisePlaceholder: "说明需要修改什么",
    submitRevision: "开始修改",
    binaryPreview: "该文件不适合文本预览，请使用“打开”。",
    close: "关闭",
    version: "版本",
  } : {
    title: "Project Work and Artifacts",
    works: "Works",
    artifacts: "Artifacts",
    noWorks: "No Work has been created yet.",
    noArtifacts: "No artifacts found yet. Files under deliverables are registered automatically after a turn completes.",
    continue: "Continue",
    sync: "Sync artifacts",
    syncing: "Syncing",
    preview: "Preview",
    open: "Open",
    reveal: "Reveal",
    final: "Set final",
    finalBadge: "Final",
    revise: "Revise",
    revisePlaceholder: "Describe the required change",
    submitRevision: "Start revision",
    binaryPreview: "This file is not suitable for text preview. Use Open instead.",
    close: "Close",
    version: "Version",
  };
}

function timeLabel(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString();
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

export function NorthwingArtifactCenter({
  workspaceRoot,
  state,
  onState,
  onClose,
}: {
  workspaceRoot: string;
  state: CoworkProjectState;
  onState: (state: CoworkProjectState) => void;
  onClose: () => void;
}) {
  const t = localText();
  const [tab, setTab] = useState<"works" | "artifacts">("works");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ artifact: CoworkArtifact; file: FilePreview } | null>(null);
  const [revising, setRevising] = useState<CoworkArtifact | null>(null);
  const [revision, setRevision] = useState("");

  const project = state.project;
  const works = useMemo(() => [...(project?.works ?? [])].sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))), [project?.works]);
  const artifacts = useMemo(() => [...(project?.artifacts ?? [])].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))), [project?.artifacts]);
  const worksByID = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const sync = async () => {
    if (busy) return;
    setBusy("sync");
    setError("");
    try {
      onState(await readCoworkProjectState(workspaceRoot, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  const resume = async (work: CoworkWorkRef) => {
    if (busy) return;
    setBusy(`work:${work.id}`);
    setError("");
    try {
      await continueCoworkWork(workspaceRoot, work);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  const showPreview = async (artifact: CoworkArtifact) => {
    setBusy(`preview:${artifact.id}`);
    setError("");
    try {
      setPreview({ artifact, file: await previewCoworkArtifact(workspaceRoot, artifact.path) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  const markFinal = async (artifact: CoworkArtifact) => {
    setBusy(`final:${artifact.id}`);
    setError("");
    try {
      onState(await setCoworkArtifactFinal(workspaceRoot, artifact.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  const submitRevision = async () => {
    if (!project || !revising || !revision.trim() || busy) return;
    setBusy(`revise:${revising.id}`);
    setError("");
    try {
      await reviseCoworkArtifact(workspaceRoot, project, revising, revision);
      setRevising(null);
      setRevision("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  return createPortal(
    <div className="northwing-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="northwing-artifact-center" role="dialog" aria-modal="true" aria-labelledby="northwing-artifact-center-title">
        <header className="northwing-artifact-center__header">
          <div>
            <h2 id="northwing-artifact-center-title">{project?.name || t.title}</h2>
            <p>{t.title}</p>
          </div>
          <div className="northwing-artifact-center__header-actions">
            <button type="button" onClick={() => void sync()} disabled={Boolean(busy)}>
              {busy === "sync" ? <LoaderCircle className="northwing-spin" size={14} /> : <RefreshCw size={14} />}
              {busy === "sync" ? t.syncing : t.sync}
            </button>
            <button type="button" className="northwing-artifact-center__close" onClick={onClose} disabled={Boolean(busy)} aria-label={t.close}><X size={17} /></button>
          </div>
        </header>

        <nav className="northwing-artifact-center__tabs" aria-label={t.title}>
          <button type="button" className={tab === "works" ? "is-active" : ""} onClick={() => setTab("works")}>
            <MessageSquareText size={14} />{t.works}<span>{works.length}</span>
          </button>
          <button type="button" className={tab === "artifacts" ? "is-active" : ""} onClick={() => setTab("artifacts")}>
            <FileOutput size={14} />{t.artifacts}<span>{artifacts.length}</span>
          </button>
        </nav>

        {error && <div className="northwing-artifact-center__error">{error}</div>}

        <div className="northwing-artifact-center__body">
          {tab === "works" ? (
            works.length === 0 ? <div className="northwing-artifact-center__empty">{t.noWorks}</div> : (
              <div className="northwing-artifact-center__list">
                {works.map((work) => (
                  <article key={work.id} className="northwing-work-row">
                    <div className="northwing-work-row__copy">
                      <strong>{work.title}</strong>
                      <span>{work.profile || "delivery"} · {timeLabel(work.updatedAt || work.createdAt)}</span>
                      <code>deliverables/{work.id}</code>
                    </div>
                    <button type="button" onClick={() => void resume(work)} disabled={Boolean(busy)}>
                      {busy === `work:${work.id}` ? <LoaderCircle className="northwing-spin" size={14} /> : <Play size={14} />}
                      {t.continue}
                    </button>
                  </article>
                ))}
              </div>
            )
          ) : (
            artifacts.length === 0 ? <div className="northwing-artifact-center__empty">{t.noArtifacts}</div> : (
              <div className="northwing-artifact-center__list">
                {artifacts.map((artifact) => {
                  const finalKey = artifact.workId || "__project__";
                  const isFinal = state.finalArtifacts?.[finalKey] === artifact.id;
                  const work = artifact.workId ? worksByID.get(artifact.workId) : undefined;
                  return (
                    <article key={artifact.id} className={`northwing-artifact-row${isFinal ? " northwing-artifact-row--final" : ""}`}>
                      <div className="northwing-artifact-row__copy">
                        <strong title={artifact.path}>{basename(artifact.path)}</strong>
                        <span>{work?.title || artifact.kind} · {t.version} {artifact.version} · {timeLabel(artifact.createdAt)}</span>
                        <code>{artifact.path}</code>
                      </div>
                      {isFinal && <span className="northwing-artifact-row__final"><CheckCircle2 size={12} />{t.finalBadge}</span>}
                      <div className="northwing-artifact-row__actions">
                        <button type="button" onClick={() => void showPreview(artifact)} disabled={Boolean(busy)}>{t.preview}</button>
                        <button type="button" onClick={() => void openCoworkArtifact(workspaceRoot, artifact.path)}><ExternalLink size={12} />{t.open}</button>
                        <button type="button" onClick={() => void revealCoworkArtifact(workspaceRoot, artifact.path)}><FolderSearch size={12} />{t.reveal}</button>
                        <button type="button" onClick={() => void markFinal(artifact)} disabled={Boolean(busy) || isFinal}><Star size={12} />{t.final}</button>
                        <button type="button" onClick={() => { setRevising(artifact); setRevision(""); }} disabled={Boolean(busy)}>{t.revise}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          )}
        </div>

        {preview && (
          <aside className="northwing-artifact-preview">
            <header><strong>{basename(preview.artifact.path)}</strong><button type="button" onClick={() => setPreview(null)}><X size={14} /></button></header>
            {preview.file.binary ? <p>{t.binaryPreview}</p> : <pre>{preview.file.body || "(empty file)"}</pre>}
          </aside>
        )}

        {revising && (
          <aside className="northwing-artifact-revision">
            <header><strong>{t.revise}: {basename(revising.path)}</strong><button type="button" onClick={() => setRevising(null)}><X size={14} /></button></header>
            <textarea autoFocus rows={4} value={revision} onChange={(event) => setRevision(event.target.value)} placeholder={t.revisePlaceholder} />
            <button type="button" onClick={() => void submitRevision()} disabled={!revision.trim() || Boolean(busy)}>
              {busy === `revise:${revising.id}` ? <LoaderCircle className="northwing-spin" size={14} /> : <MessageSquareText size={14} />}
              {t.submitRevision}
            </button>
          </aside>
        )}
      </section>
    </div>,
    document.body,
  );
}
