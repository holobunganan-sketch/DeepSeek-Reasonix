import type { UpdateInfo } from "./types";
import type {
  CoworkArtifact,
  CoworkProject,
  CoworkProjectState,
  CoworkWorkRef,
} from "./northwingCowork";

type CoworkProjectSummary = {
  workspace: string;
  exists: boolean;
  id?: string;
  name?: string;
  updatedAt?: string;
  workCount: number;
  artifactCount: number;
  latestWork?: CoworkWorkRef;
  latestArtifact?: CoworkArtifact;
  error?: string;
};

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

export type NorthwingLaunch = {
  raw: string;
  action: string;
  workspace?: string;
  mode?: "chat" | "work" | string;
};

declare module "./bridge" {
  interface AppBindings {
    CreateCoworkProject?(workspaceRoot: string, name: string): Promise<CoworkProject>;
    LoadCoworkProject?(workspaceRoot: string): Promise<CoworkProject>;
    CoworkProjectState?(workspaceRoot: string, syncArtifacts: boolean): Promise<CoworkProjectState>;
    CoworkProjectSummaries?(workspaceRoots: string[]): Promise<CoworkProjectSummary[]>;
    UpsertCoworkWork?(workspaceRoot: string, work: CoworkWorkRef): Promise<CoworkProject>;
    LinkCoworkWork?(workspaceRoot: string, title: string, sessionPath: string, goalID: string, profile: string): Promise<CoworkProject>;
    SyncCoworkArtifacts?(workspaceRoot: string): Promise<CoworkProject>;
    SetCoworkArtifactFinal?(workspaceRoot: string, artifactID: string): Promise<CoworkProjectState>;
    RegisterCoworkArtifact?(workspaceRoot: string, path: string, kind: string, workID: string): Promise<CoworkProject>;
    InspectCoworkArtifact?(workspaceRoot: string, artifactPath: string): Promise<NorthwingOfficeReport>;
    PendingNorthwingLaunches?(): Promise<NorthwingLaunch[]>;
    CheckNorthwingUpdate?(): Promise<UpdateInfo | null>;
    OpenNorthwingDownloadPage?(): Promise<void>;
  }
}

export {};
