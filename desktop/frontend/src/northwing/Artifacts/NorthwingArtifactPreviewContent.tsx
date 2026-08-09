import { useEffect, useState } from "react";

export type NorthwingArtifactPreviewContentProps = {
  artifact: {
    id: string;
    path: string;
    kind: string;
    version: number;
  };
  workspaceRoot: string;
};

export function NorthwingArtifactPreviewContent({
  artifact,
  workspaceRoot,
}: NorthwingArtifactPreviewContentProps) {
  const [state, setState] = useState<"loading" | "loaded" | "binary" | "error">("loading");
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const { previewCoworkArtifact } = await import("../../lib/northwingCowork");
        const file = await previewCoworkArtifact(workspaceRoot, artifact.path);
        if (cancelled) return;
        if (file.kind === "image" && file.url) {
          setUrl(file.url);
          setState("loaded");
        } else if (file.kind === "pdf" && file.url) {
          setUrl(file.url);
          setState("loaded");
        } else if (file && !file.binary) {
          setUrl(undefined);
          setState("loaded");
        } else {
          setState("binary");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifact.path, workspaceRoot]);

  if (state === "loading") {
    return <div className="nw-artifact-preview__loading">Loading preview...</div>;
  }
  if (state === "error") {
    return <div className="nw-artifact-preview__error">Preview unavailable</div>;
  }
  if (state === "binary") {
    return <div className="nw-artifact-preview__binary">This file does not support embedded preview.</div>;
  }
  if (url && /\.(png|jpe?g|gif|webp|svg)$/i.test(artifact.path)) {
    return <img src={url} alt={basename(artifact.path)} className="nw-artifact-preview__image" />;
  }
  if (url && /\.pdf$/i.test(artifact.path)) {
    return <iframe src={url} title={basename(artifact.path)} className="nw-artifact-preview__pdf" />;
  }
  return <div className="nw-artifact-preview__unsupported">Preview format not supported</div>;
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}
