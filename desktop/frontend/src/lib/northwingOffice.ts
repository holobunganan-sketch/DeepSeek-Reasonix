import { app } from "./bridge";
import "./northwingOffice.css";

export type NorthwingOfficeReport = {
  path: string;
  kind: string;
  valid: boolean;
  size: number;
  pages?: number;
  slides?: number;
  sheets?: number;
  paragraphs?: number;
  cells?: number;
  entries?: number;
  preview?: string[];
  warnings?: string[];
};

type OfficeBinding = {
  InspectCoworkArtifact?: (workspaceRoot: string, artifactPath: string) => Promise<NorthwingOfficeReport>;
};

export async function inspectCoworkArtifact(workspaceRoot: string, artifactPath: string): Promise<NorthwingOfficeReport> {
  const method = (app as typeof app & OfficeBinding).InspectCoworkArtifact;
  if (typeof method !== "function") {
    throw new Error("Northwing Office inspection is unavailable; rebuild the Wails desktop app.");
  }
  return method(workspaceRoot, artifactPath);
}

export function isOfficeArtifact(path: string): boolean {
  return /\.(docx|pptx|xlsx|pdf)$/i.test(path.trim());
}
