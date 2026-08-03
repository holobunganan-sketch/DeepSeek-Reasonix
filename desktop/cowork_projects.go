package main

import "reasonix/internal/cowork"

var desktopCoworkStore = cowork.NewStore()

// CreateCoworkProject initializes the minimal Northwing manifest inside an
// existing workspace. Reasonix remains the owner of sessions, Goals, tools,
// permissions, memory, checkpoints, and execution state.
func (a *App) CreateCoworkProject(workspaceRoot, name string) (cowork.Project, error) {
	return desktopCoworkStore.Create(workspaceRoot, name)
}

// LoadCoworkProject returns the project links used by the Northwing desktop
// surface without loading or duplicating session content.
func (a *App) LoadCoworkProject(workspaceRoot string) (cowork.Project, error) {
	return desktopCoworkStore.Load(workspaceRoot)
}

// CoworkProjectSummaries reads all visible project manifests behind one Wails
// call. The result contains counts and latest references only; it never loads
// session transcripts, artifact bodies, or Reasonix execution state.
func (a *App) CoworkProjectSummaries(workspaceRoots []string) []cowork.ProjectSummary {
	return desktopCoworkStore.Summaries(workspaceRoots)
}

// LinkCoworkWork associates one existing Reasonix session/Goal with a project.
// The Reasonix runtime profile is stored as a launch hint; active execution state
// remains inside the existing controller and session stores.
func (a *App) LinkCoworkWork(
	workspaceRoot string,
	title string,
	sessionPath string,
	goalID string,
	profile string,
) (cowork.Project, error) {
	return desktopCoworkStore.LinkWork(workspaceRoot, cowork.WorkRef{
		Title:       title,
		SessionPath: sessionPath,
		GoalID:      goalID,
		Profile:     profile,
	})
}

// RegisterCoworkArtifact records a versioned deliverable already created inside
// the workspace. It hashes the file in place and never copies its contents into
// Northwing metadata.
func (a *App) RegisterCoworkArtifact(
	workspaceRoot string,
	path string,
	kind string,
	workID string,
) (cowork.Project, error) {
	return desktopCoworkStore.RegisterArtifact(workspaceRoot, cowork.Artifact{
		Path:   path,
		Kind:   kind,
		WorkID: workID,
	})
}
