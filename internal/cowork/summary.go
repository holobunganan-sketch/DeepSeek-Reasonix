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
	Workspace       string    `json:"workspace"`
	Exists          bool      `json:"exists"`
	ID              string    `json:"id,omitempty"`
	Name            string    `json:"name,omitempty"`
	UpdatedAt       time.Time `json:"updatedAt,omitempty"`
	WorkCount       int       `json:"workCount"`
	ArtifactCount   int       `json:"artifactCount"`
	LatestWork      *WorkRef  `json:"latestWork,omitempty"`
	LatestArtifact  *Artifact `json:"latestArtifact,omitempty"`
	Error           string    `json:"error,omitempty"`
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
