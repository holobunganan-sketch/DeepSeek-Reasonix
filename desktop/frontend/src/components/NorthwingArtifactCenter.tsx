import { useMemo, useState } from "react";
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
} from "../lib/northwingCowork";
import { inspectCoworkArtifact, isOfficeArtifact, type NorthwingOfficeReport } from "../lib/northwingOffice";
import type { FilePreview } from "../lib/types";
import { ResizableDrawer } from "./ResizableDrawer";
import "./NorthwingArtifactCenter.css";

function localText() {
  const chinese = typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language);
  return chinese ? {
    title: "Work 与成品",
    overview: "概览",
    artifacts: "成品",
    noArtifacts: "当前 Work 尚未发现成品。任务完成后，deliverables 目录中的文件会自动登记。",
    continue: "继续 Work",
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
    binaryPreview: "该文件不适合内置预览，请使用“打开”。",
    close: "关闭",
    version: "版本",
    valid: "结构有效",
    invalid: "结构异常",
    pages: "页",
    slides: "张幻灯片",
    sheets: "个工作表",
    paragraphs: "个段落",
    cells: "个单元格",
    inheritedModel: "当前／默认模型",
    stage: "阶段",
    acceptance: "验收",
  } : {
    title: "Work and artifacts",
    overview: "Overview",
    artifacts: "Artifacts",
    noArtifacts: "No artifacts have been found for this Work. Files under deliverables are registered after a turn completes.",
    continue: "Continue Work",
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
    binaryPreview: "This file does not support embedded preview. Use Open instead.",
    close: "Close",
    version: "Version",
    valid: "Structure valid",
    invalid: "Structure invalid",
    pages: "pages",
    slides: "slides",
    sheets: "sheets",
    paragraphs: "paragraphs",
    cells: "cells",
    inheritedModel: "current/default model",
    stage: "Stage",
    acceptance: "Acceptance",
  };
}

function timeLabel(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "";
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function NorthwingArtifactCenter({
  workspaceRoot,
  workId,
  state,
  onState,
  onClose,
}: {
  workspaceRoot: string;
  workId: string;
  state: CoworkProjectState;
  onState: (state: CoworkProjectState) => void;
  onClose: () => void;
}) {
  const t = localText();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ artifact: CoworkArtifact; file?: FilePreview; office?: NorthwingOfficeReport } | null>(null);
  const [revising, setRevising] = useState<CoworkArtifact | null>(null);
  const [revision, setRevision] = useState("");

  const project = state.project;
  const work = useMemo(() => project?.works?.find((candidate) => candidate.id === workId), [project?.works, workId]);
  const artifacts = useMemo(() => [...(project?.artifacts ?? [])]
    .filter((artifact) => artifact.workId === workId)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))), [project?.artifacts, workId]);

  const sync = async () => {
    if (busy) return;
    setBusy("sync");
    setError("");
    try { onState(await readCoworkProjectState(workspaceRoot, true)); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(""); }
  };

  const resume = async () => {
    if (!work || busy) return;
    setBusy(`work:${work.id}`);
    setError("");
    try {
      await continueCoworkWork(workspaceRoot, work);
      onClose();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(""); }
  };

  const showPreview = async (artifact: CoworkArtifact) => {
    setBusy(`preview:${artifact.id}`);
    setError("");
    try {
      const office = isOfficeArtifact(artifact.path)
        ? await inspectCoworkArtifact(workspaceRoot, artifact.path)
        : undefined;
      const file = /\.(pdf|png|jpe?g|gif|webp|svg|txt|md|json|csv|html?|xml|ya?ml)$/i.test(artifact.path)
        ? await previewCoworkArtifact(workspaceRoot, artifact.path)
        : undefined;
      setPreview({ artifact, file, office });
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(""); }
  };

  const openArtifact = async (artifact: CoworkArtifact) => {
    setError("");
    try { await openCoworkArtifact(workspaceRoot, artifact.path); }
    catch (err) { setError(errorText(err)); }
  };

  const revealArtifact = async (artifact: CoworkArtifact) => {
    setError("");
    try { await revealCoworkArtifact(workspaceRoot, artifact.path); }
    catch (err) { setError(errorText(err)); }
  };

  const markFinal = async (artifact: CoworkArtifact) => {
    setBusy(`final:${artifact.id}`);
    setError("");
    try { onState(await setCoworkArtifactFinal(workspaceRoot, artifact.id)); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(""); }
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
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(""); }
  };

  const officeMetrics = (report: NorthwingOfficeReport) => [
    report.pages ? `${report.pages} ${t.pages}` : "",
    report.slides ? `${report.slides} ${t.slides}` : "",
    report.sheets ? `${report.sheets} ${t.sheets}` : "",
    report.paragraphs ? `${report.paragraphs} ${t.paragraphs}` : "",
    report.cells ? `${report.cells} ${t.cells}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <ResizableDrawer onClose={onClose} subtle>
      <section className="northwing-artifact-center" aria-label={t.title}>
        <header className="northwing-artifact-center__header">
          <div>
            <h2>{work?.title || t.title}</h2>
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

        {error && <div className="northwing-artifact-center__error">{error}</div>}

        {work && (
          <section className="northwing-work-overview">
            <div><span>{t.overview}</span><strong>{work.title}</strong></div>
            <dl>
              <div><dt>{t.stage}</dt><dd>{work.stage || "planning"}</dd></div>
              <div><dt>{t.acceptance}</dt><dd>{work.completedCriteria ?? 0}/{work.totalCriteria ?? 0}</dd></div>
              <div><dt>Policy</dt><dd>{work.kind || "general"} · {work.quality || "standard"} · {work.sourcePolicy || "project_only"}</dd></div>
              <div><dt>Model</dt><dd>{work.modelRef || t.inheritedModel}{work.reasoningEffort ? ` · ${work.reasoningEffort}` : ""}</dd></div>
            </dl>
            <button type="button" onClick={() => void resume()} disabled={Boolean(busy)}>
              {busy === `work:${work.id}` ? <LoaderCircle className="northwing-spin" size={14} /> : <Play size={14} />}
              {t.continue}
            </button>
          </section>
        )}

        <section className="northwing-artifact-center__body">
          <header className="northwing-artifact-center__section-title"><FileOutput size={14} />{t.artifacts}<span>{artifacts.length}</span></header>
          {artifacts.length === 0 ? <div className="northwing-artifact-center__empty">{t.noArtifacts}</div> : (
            <div className="northwing-artifact-center__list">{artifacts.map((artifact) => {
              const isFinal = state.finalArtifacts?.[workId] === artifact.id;
              return (
                <article key={artifact.id} className={`northwing-artifact-row${isFinal ? " northwing-artifact-row--final" : ""}`}>
                  <div className="northwing-artifact-row__copy">
                    <strong title={artifact.path}>{basename(artifact.path)}</strong>
                    <span>{artifact.kind} · {t.version} {artifact.version} · {timeLabel(artifact.createdAt)}</span>
                    <code>{artifact.path}</code>
                  </div>
                  {isFinal && <span className="northwing-artifact-row__final"><CheckCircle2 size={12} />{t.finalBadge}</span>}
                  <div className="northwing-artifact-row__actions">
                    <button type="button" onClick={() => void showPreview(artifact)} disabled={Boolean(busy)}>{t.preview}</button>
                    <button type="button" onClick={() => void openArtifact(artifact)}><ExternalLink size={12} />{t.open}</button>
                    <button type="button" onClick={() => void revealArtifact(artifact)}><FolderSearch size={12} />{t.reveal}</button>
                    <button type="button" onClick={() => void markFinal(artifact)} disabled={Boolean(busy) || isFinal}><Star size={12} />{t.final}</button>
                    <button type="button" onClick={() => { setRevising(artifact); setRevision(""); }} disabled={Boolean(busy)}>{t.revise}</button>
                  </div>
                </article>
              );
            })}</div>
          )}
        </section>

        {preview && (
          <aside className="northwing-artifact-preview">
            <header><strong>{basename(preview.artifact.path)}</strong><button type="button" onClick={() => setPreview(null)}><X size={14} /></button></header>
            {preview.office && (
              <div className="northwing-artifact-preview__office">
                <strong className={preview.office.valid ? "is-valid" : "is-invalid"}>{preview.office.valid ? t.valid : t.invalid}</strong>
                {officeMetrics(preview.office) && <span>{officeMetrics(preview.office)}</span>}
                {preview.office.preview?.length ? <ul>{preview.office.preview.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> : null}
                {preview.office.warnings?.length ? <ul className="is-warning">{preview.office.warnings.map((line) => <li key={line}>{line}</li>)}</ul> : null}
              </div>
            )}
            {preview.file?.kind === "image" && preview.file.url ? (
              <img src={preview.file.url} alt={basename(preview.artifact.path)} />
            ) : preview.file?.kind === "pdf" && preview.file.url ? (
              <iframe src={preview.file.url} title={basename(preview.artifact.path)} />
            ) : preview.file && !preview.file.binary ? (
              <pre>{preview.file.body || "(empty file)"}</pre>
            ) : !preview.office ? <p>{t.binaryPreview}</p> : null}
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
    </ResizableDrawer>
  );
}
