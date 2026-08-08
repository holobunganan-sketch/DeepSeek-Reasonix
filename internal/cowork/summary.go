package cowork

import (
	"errors"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ProjectSummary is the compact desktop projection of a Northwing manifest.
// It intentionally excludes session content, Goal state, tool history, and file
// bodies so listing projects never expands model context or duplicates Reasonix
// runtime state.
type ProjectSummary struct {
	Workspace      string    `json:"workspace"`
	Exists         bool      `json:"exists"`
	ID             string    `json:"id,omitempty"`
	Name           string    `json:"name,omitempty"`
	UpdatedAt      time.Time `json:"updatedAt,omitempty"`
	WorkCount      int       `json:"workCount"`
	ArtifactCount  int       `json:"artifactCount"`
	LatestWork     *WorkRef  `json:"latestWork,omitempty"`
	LatestArtifact *Artifact `json:"latestArtifact,omitempty"`
	Works          []WorkRef `json:"works,omitempty"`
	Error          string    `json:"error,omitempty"`
}

// WorkSummary is the cheap desktop projection of one Work for product surfaces
// such as Home and Work list. It carries no transcript, no artifact body, and
// no Reasonix runtime state.
type WorkSummary struct {
	WorkID            string            `json:"workId"`
	ProjectID         string            `json:"projectId"`
	ProjectName       string            `json:"projectName"`
	Workspace         string            `json:"workspace"`
	Title             string            `json:"title"`
	Stage             WorkStage         `json:"stage"`
	Quality           string            `json:"quality"`
	SourcePolicy      string            `json:"sourcePolicy"`
	CompletedCriteria int               `json:"completedCriteria"`
	TotalCriteria     int               `json:"totalCriteria"`
	SessionKind       string            `json:"sessionKind"`
	BindingStatus     WorkBindingStatus `json:"bindingStatus"`
	UpdatedAt         time.Time         `json:"updatedAt"`
}

// ArtifactSummary is the cheap desktop projection of one Artifact for product
// surfaces such as Home and the global Artifacts page. It carries no file body.
type ArtifactSummary struct {
	ID          string    `json:"id"`
	Path        string    `json:"path"`
	Kind        string    `json:"kind"`
	WorkID      string    `json:"workId"`
	Version     int       `json:"version"`
	Final       bool      `json:"final"`
	ProjectID   string    `json:"projectId"`
	ProjectName string    `json:"projectName"`
	Workspace   string    `json:"workspace"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Catalog is the top-level Northwing product projection used by Home, Projects,
// Work list, and the global Artifacts page. It is built from manifests and the
// final-artifact index without scanning deliverable directories or decoding
// transcripts.
type Catalog struct {
	Projects        []ProjectSummary  `json:"projects"`
	ActiveWorks     []WorkSummary     `json:"activeWorks"`
	WaitingForUser  []WorkSummary     `json:"waitingForUser"`
	RecentArtifacts []ArtifactSummary `json:"recentArtifacts"`
}

func isTerminalStage(stage WorkStage) bool {
	return stage == WorkStageCompleted || stage == WorkStageFailed
}

// Summaries reads multiple manifests behind one desktop binding. This avoids an
// N+1 Wails call pattern while keeping each manifest independent and portable.
// Missing manifests are normal: an ordinary Reasonix workspace remains fully
// usable until the user chooses to make it a Northwing project.
func (s *Store) Summaries(workspaceRoots []string) []ProjectSummary {
	seen := make(map[string]struct{}, len(workspaceRoots))
	out := make([]ProjectSummary, 0, len(workspaceRoots))
	for _, requestedRoot := range workspaceRoots {
		requestedRoot = strings.TrimSpace(requestedRoot)
		if requestedRoot == "" {
			continue
		}
		key := filepath.Clean(requestedRoot)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		project, err := s.Load(requestedRoot)
		if err != nil {
			summary := ProjectSummary{Workspace: requestedRoot}
			if errors.Is(err, ErrProjectNotFound) {
				out = append(out, summary)
				continue
			}
			summary.Error = err.Error()
			out = append(out, summary)
			continue
		}

		summary := ProjectSummary{
			Workspace:     project.Workspace,
			Exists:        true,
			ID:            project.ID,
			Name:          project.Name,
			UpdatedAt:     project.UpdatedAt,
			WorkCount:     len(project.Works),
			ArtifactCount: len(project.Artifacts),
			Works:         append([]WorkRef(nil), project.Works...),
		}
		if len(project.Works) > 0 {
			works := append([]WorkRef(nil), project.Works...)
			sort.SliceStable(works, func(i, j int) bool {
				return works[i].UpdatedAt.After(works[j].UpdatedAt)
			})
			latest := works[0]
			summary.LatestWork = &latest
		}
		if len(project.Artifacts) > 0 {
			artifacts := append([]Artifact(nil), project.Artifacts...)
			sort.SliceStable(artifacts, func(i, j int) bool {
				return artifacts[i].CreatedAt.After(artifacts[j].CreatedAt)
			})
			latest := artifacts[0]
			summary.LatestArtifact = &latest
		}
		out = append(out, summary)
	}
	return out
}

// Catalog builds a cheap cross-project Northwing projection from manifests and
// the final-artifact index. It never scans deliverable directories or decodes
// transcripts, so it is safe to call on every Home render.
func (s *Store) Catalog(workspaceRoots []string) (Catalog, error) {
	seen := make(map[string]struct{}, len(workspaceRoots))
	catalog := Catalog{
		Projects:        make([]ProjectSummary, 0, len(workspaceRoots)),
		ActiveWorks:     make([]WorkSummary, 0),
		WaitingForUser:  make([]WorkSummary, 0),
		RecentArtifacts: make([]ArtifactSummary, 0),
	}

	for _, requestedRoot := range workspaceRoots {
		requestedRoot = strings.TrimSpace(requestedRoot)
		if requestedRoot == "" {
			continue
		}
		key := filepath.Clean(requestedRoot)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		project, err := s.Load(requestedRoot)
		if err != nil {
			summary := ProjectSummary{Workspace: requestedRoot}
			if errors.Is(err, ErrProjectNotFound) {
				catalog.Projects = append(catalog.Projects, summary)
				continue
			}
			summary.Error = err.Error()
			catalog.Projects = append(catalog.Projects, summary)
			continue
		}

		finalIndex, err := readFinalArtifactIndex(project.Workspace)
		if err != nil {
			finalIndex = finalArtifactIndex{Version: FinalArtifactsVersion, ByWork: map[string]string{}}
		}

		projectSummary := ProjectSummary{
			Workspace:     project.Workspace,
			Exists:        true,
			ID:            project.ID,
			Name:          project.Name,
			UpdatedAt:     project.UpdatedAt,
			WorkCount:     len(project.Works),
			ArtifactCount: len(project.Artifacts),
		}
		catalog.Projects = append(catalog.Projects, projectSummary)

		for _, work := range project.Works {
			summary := WorkSummary{
				WorkID:            work.ID,
				ProjectID:         project.ID,
				ProjectName:       project.Name,
				Workspace:         project.Workspace,
				Title:             work.Title,
				Stage:             work.Stage,
				Quality:           work.Quality,
				SourcePolicy:      work.SourcePolicy,
				CompletedCriteria: work.CompletedCriteria,
				TotalCriteria:     work.TotalCriteria,
				SessionKind:       "work",
				BindingStatus:     NormalizeBindingStatus(work.BindingStatus),
				UpdatedAt:         work.UpdatedAt,
			}
			if !isTerminalStage(summary.Stage) {
				catalog.ActiveWorks = append(catalog.ActiveWorks, summary)
			}
			if summary.Stage == WorkStageWaitingUser {
				catalog.WaitingForUser = append(catalog.WaitingForUser, summary)
			}
		}

		for _, artifact := range project.Artifacts {
			finalID, isFinal := finalIndex.ByWork[artifact.WorkID]
			final := isFinal && finalID == artifact.ID
			catalog.RecentArtifacts = append(catalog.RecentArtifacts, ArtifactSummary{
				ID:          artifact.ID,
				Path:        artifact.Path,
				Kind:        artifact.Kind,
				WorkID:      artifact.WorkID,
				Version:     artifact.Version,
				Final:       final,
				ProjectID:   project.ID,
				ProjectName: project.Name,
				Workspace:   project.Workspace,
				CreatedAt:   artifact.CreatedAt,
			})
		}
	}

	sort.SliceStable(catalog.ActiveWorks, func(i, j int) bool {
		return catalog.ActiveWorks[i].UpdatedAt.After(catalog.ActiveWorks[j].UpdatedAt)
	})
	sort.SliceStable(catalog.WaitingForUser, func(i, j int) bool {
		return catalog.WaitingForUser[i].UpdatedAt.After(catalog.WaitingForUser[j].UpdatedAt)
	})
	sort.SliceStable(catalog.RecentArtifacts, func(i, j int) bool {
		return catalog.RecentArtifacts[i].CreatedAt.After(catalog.RecentArtifacts[j].CreatedAt)
	})

	return catalog, nil
}
