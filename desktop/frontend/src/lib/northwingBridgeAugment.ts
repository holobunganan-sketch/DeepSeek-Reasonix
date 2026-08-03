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

// Wails regenerates App method declarations from the Go surface. Keeping the
// Northwing additions optional preserves the browser-dev mock while extending
// bridge.ts's generated-method drift check after a real desktop build.
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
  }
}

export {};
