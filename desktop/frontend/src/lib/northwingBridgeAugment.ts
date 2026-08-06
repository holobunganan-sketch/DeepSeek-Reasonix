import type {
  CoworkProject,
  CoworkProjectState,
  CoworkProjectSummary,
  CoworkWorkRef,
} from "./northwingCowork";

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

// These methods are generated as required Wails bindings. Referencing them
// here keeps the Northwing-specific bridge contract explicit without merging
// duplicate optional properties into AppBindings.
export type NorthwingGeneratedUpdateBindings = Pick<
  import("./bridge").AppBindings,
  "CheckNorthwingUpdate" | "ApplyNorthwingUpdateRequest"
>;

declare module "./bridge" {
  interface AppBindings {
    CreateCoworkProject?(workspaceRoot: string, name: string): Promise<CoworkProject>;
    LoadCoworkProject?(workspaceRoot: string): Promise<CoworkProject>;
    CoworkProjectState?(workspaceRoot: string, syncArtifacts: boolean): Promise<CoworkProjectState>;
    CoworkProjectSummaries?(workspaceRoots: string[]): Promise<CoworkProjectSummary[]>;
    UpsertCoworkWork?(workspaceRoot: string, work: CoworkWorkRef): Promise<CoworkProject>;
    UpdateCoworkWorkProgress?(workspaceRoot: string, workID: string, stage: string, completedCriteria: number, totalCriteria: number): Promise<CoworkProject>;
    LinkCoworkWork?(workspaceRoot: string, title: string, sessionPath: string, goalID: string, profile: string): Promise<CoworkProject>;
    SyncCoworkArtifacts?(workspaceRoot: string): Promise<CoworkProject>;
    SetCoworkArtifactFinal?(workspaceRoot: string, artifactID: string): Promise<CoworkProjectState>;
    RegisterCoworkArtifact?(workspaceRoot: string, path: string, kind: string, workID: string): Promise<CoworkProject>;
    InspectCoworkArtifact?(workspaceRoot: string, artifactPath: string): Promise<NorthwingOfficeReport>;
    PendingNorthwingLaunches?(): Promise<NorthwingLaunch[]>;
  }
}

export {};
