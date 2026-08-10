import { app } from "../../lib/bridge";
import {
  createCoworkProject,
  readCoworkProjectState,
  type CoworkProject,
} from "../../lib/northwingCowork";

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "Northwing Project";
}

export async function createNewNorthwingProject(): Promise<{
  workspaceRoot: string;
  project: CoworkProject;
} | null> {
  const workspaceRoot = (await app.PickWorkspace()).trim();
  if (!workspaceRoot) return null;

  const state = await readCoworkProjectState(workspaceRoot, false);
  if (state.error) {
    throw new Error(`Northwing could not inspect the selected folder: ${state.error}`);
  }
  if (state.exists) {
    throw new Error("This folder is already a Northwing Project. Its manifest was left unchanged.");
  }

  try {
    const project = await createCoworkProject(workspaceRoot, basename(workspaceRoot));
    return { workspaceRoot, project };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists/i.test(message)) {
      throw new Error("This folder is already a Northwing Project. Its manifest was left unchanged.");
    }
    throw error;
  }
}
