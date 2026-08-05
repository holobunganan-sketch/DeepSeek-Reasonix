package cowork

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"reasonix/internal/fileutil"
)

const (
	FinalArtifactsVersion  = 1
	FinalArtifactsFileName = "final-artifacts.json"
)

var ErrArtifactNotFound = errors.New("cowork artifact not found")

// ProjectState is the desktop-facing state for one Northwing project. It keeps
// final selections outside project.json so the core Project/Work/Artifact index
// stays append-only and portable.
type ProjectState struct {
	Exists         bool              `json:"exists"`
	Project        *Project          `json:"project,omitempty"`
	FinalArtifacts map[string]string `json:"finalArtifacts,omitempty"`
	Error          string            `json:"error,omitempty"`
}

type finalArtifactIndex struct {
	Version int               `json:"version"`
	ByWork  map[string]string `json:"byWork"`
}

type artifactCandidate struct {
	Path   string
	WorkID string
}

// WorkOutputDir is the deterministic deliverable boundary for a Work. The path
// does not need to be stored in the manifest, which keeps WorkRef small and makes
// artifact discovery deterministic after a restart.
func WorkOutputDir(workID string) string {
	workID = strings.TrimSpace(workID)
	if validateWorkID(workID) != nil {
		return ""
	}
	return filepath.ToSlash(filepath.Join("deliverables", workID))
}

// SyncArtifacts scans each Work's deterministic output directory and appends a
// new Artifact version only when the file hash changed. It performs one manifest
// load and one atomic manifest write for the whole project.
func (s *Store) SyncArtifacts(workspaceRoot string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	project, err := s.loadUnlocked(workspaceRoot)
	if err != nil {
		return Project{}, err
	}

	latestByPath := make(map[string]Artifact, len(project.Artifacts))
	knownHashesByPath := make(map[string]map[string]struct{}, len(project.Artifacts))
	for _, artifact := range project.Artifacts {
		current, ok := latestByPath[artifact.Path]
		if !ok || artifact.Version > current.Version {
			latestByPath[artifact.Path] = artifact
		}
		knownHashes := knownHashesByPath[artifact.Path]
		if knownHashes == nil {
			knownHashes = make(map[string]struct{})
			knownHashesByPath[artifact.Path] = knownHashes
		}
		knownHashes[artifact.SHA256] = struct{}{}
	}

	candidates := make([]artifactCandidate, 0)
	for _, work := range project.Works {
		workID := strings.TrimSpace(work.ID)
		if workID == "" {
			continue
		}
		outputRel := WorkOutputDir(workID)
		if outputRel == "" {
			return Project{}, fmt.Errorf("%w: %q", ErrInvalidWorkID, workID)
		}
		outputDir := filepath.Join(project.Workspace, filepath.FromSlash(outputRel))
		info, err := os.Stat(outputDir)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return Project{}, fmt.Errorf("inspect work output directory: %w", err)
		}
		if !info.IsDir() {
			return Project{}, fmt.Errorf("work output path is not a directory: %s", outputDir)
		}
		resolvedDir, err := filepath.EvalSymlinks(outputDir)
		if err != nil {
			return Project{}, fmt.Errorf("resolve work output directory: %w", err)
		}
		if !pathWithin(project.Workspace, resolvedDir) {
			return Project{}, fmt.Errorf("%w: %s", ErrArtifactOutsideWorkspace, outputDir)
		}
		if err := filepath.WalkDir(resolvedDir, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				if path != resolvedDir && strings.HasPrefix(entry.Name(), ".") {
					return filepath.SkipDir
				}
				return nil
			}
			if !entry.Type().IsRegular() || !artifactCandidateName(entry.Name()) {
				return nil
			}
			rel, err := filepath.Rel(project.Workspace, path)
			if err != nil {
				return err
			}
			candidates = append(candidates, artifactCandidate{
				Path:   filepath.ToSlash(filepath.Clean(rel)),
				WorkID: workID,
			})
			return nil
		}); err != nil {
			return Project{}, fmt.Errorf("scan work output directory: %w", err)
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Path == candidates[j].Path {
			return candidates[i].WorkID < candidates[j].WorkID
		}
		return candidates[i].Path < candidates[j].Path
	})

	changed := false
	for _, candidate := range candidates {
		rel, full, info, err := resolveArtifact(project.Workspace, candidate.Path)
		if err != nil {
			return Project{}, err
		}
		digest, err := hashFile(full)
		if err != nil {
			return Project{}, err
		}
		if _, exists := knownHashesByPath[rel][digest]; exists {
			continue
		}
		latest, exists := latestByPath[rel]
		id, err := newID()
		if err != nil {
			return Project{}, err
		}
		version := 1
		if exists {
			version = latest.Version + 1
		}
		kind := strings.TrimPrefix(strings.ToLower(filepath.Ext(rel)), ".")
		if kind == "" {
			kind = "file"
		}
		artifact := Artifact{
			ID:        id,
			Path:      rel,
			Kind:      kind,
			WorkID:    candidate.WorkID,
			Version:   version,
			SHA256:    digest,
			Size:      info.Size(),
			CreatedAt: s.now(),
		}
		project.Artifacts = append(project.Artifacts, artifact)
		latestByPath[rel] = artifact
		knownHashes := knownHashesByPath[rel]
		if knownHashes == nil {
			knownHashes = make(map[string]struct{})
			knownHashesByPath[rel] = knownHashes
		}
		knownHashes[digest] = struct{}{}
		changed = true
	}

	if !changed {
		return project, nil
	}
	project.UpdatedAt = s.now()
	if err := writeProject(project); err != nil {
		return Project{}, err
	}
	return project, nil
}

// State returns one current project and its final selections. Missing manifests
// are a normal state for ordinary Reasonix workspaces.
func (s *Store) State(workspaceRoot string, syncArtifacts bool) ProjectState {
	var (
		project Project
		err     error
	)
	if syncArtifacts {
		project, err = s.SyncArtifacts(workspaceRoot)
	} else {
		project, err = s.Load(workspaceRoot)
	}
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			return ProjectState{Exists: false}
		}
		return ProjectState{Exists: false, Error: err.Error()}
	}
	finals, err := readFinalArtifactIndex(project.Workspace)
	if err != nil {
		return ProjectState{Exists: true, Project: &project, Error: err.Error()}
	}
	return ProjectState{
		Exists:         true,
		Project:        &project,
		FinalArtifacts: finals.ByWork,
	}
}

// SetFinalArtifact selects one registered version as the final deliverable for
// its Work. The selection is metadata only and never moves or copies the file.
func (s *Store) SetFinalArtifact(workspaceRoot, artifactID string) (ProjectState, error) {
	s.mu.Lock()
	project, err := s.loadUnlocked(workspaceRoot)
	if err != nil {
		s.mu.Unlock()
		return ProjectState{}, err
	}
	artifactID = strings.TrimSpace(artifactID)
	var selected *Artifact
	for i := range project.Artifacts {
		if project.Artifacts[i].ID == artifactID {
			artifact := project.Artifacts[i]
			selected = &artifact
			break
		}
	}
	if selected == nil {
		s.mu.Unlock()
		return ProjectState{}, fmt.Errorf("%w: %s", ErrArtifactNotFound, artifactID)
	}
	index, err := readFinalArtifactIndex(project.Workspace)
	if err != nil {
		s.mu.Unlock()
		return ProjectState{}, err
	}
	key := selected.WorkID
	if strings.TrimSpace(key) == "" {
		key = "__project__"
	}
	index.ByWork[key] = selected.ID
	if err := writeFinalArtifactIndex(project.Workspace, index); err != nil {
		s.mu.Unlock()
		return ProjectState{}, err
	}
	s.mu.Unlock()
	return s.State(workspaceRoot, false), nil
}

func finalArtifactsPath(workspaceRoot string) string {
	return filepath.Join(workspaceRoot, MetadataDirName, FinalArtifactsFileName)
}

func readFinalArtifactIndex(workspaceRoot string) (finalArtifactIndex, error) {
	index := finalArtifactIndex{Version: FinalArtifactsVersion, ByWork: map[string]string{}}
	data, err := os.ReadFile(finalArtifactsPath(workspaceRoot))
	if os.IsNotExist(err) {
		return index, nil
	}
	if err != nil {
		return index, fmt.Errorf("read final artifact index: %w", err)
	}
	if err := json.Unmarshal(data, &index); err != nil {
		return index, fmt.Errorf("decode final artifact index: %w", err)
	}
	if index.Version != FinalArtifactsVersion {
		return index, fmt.Errorf("unsupported final artifact index version: %d", index.Version)
	}
	if index.ByWork == nil {
		index.ByWork = map[string]string{}
	}
	return index, nil
}

func writeFinalArtifactIndex(workspaceRoot string, index finalArtifactIndex) error {
	index.Version = FinalArtifactsVersion
	if index.ByWork == nil {
		index.ByWork = map[string]string{}
	}
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return fmt.Errorf("encode final artifact index: %w", err)
	}
	data = append(data, '\n')
	if err := fileutil.AtomicWriteFileStrict(finalArtifactsPath(workspaceRoot), data, 0o600); err != nil {
		return fmt.Errorf("write final artifact index: %w", err)
	}
	return nil
}

func artifactCandidateName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || strings.HasPrefix(name, ".") || strings.HasSuffix(name, "~") {
		return false
	}
	switch strings.ToLower(filepath.Ext(name)) {
	case ".tmp", ".part", ".crdownload":
		return false
	}
	switch strings.ToLower(name) {
	case "thumbs.db", ".ds_store":
		return false
	}
	return true
}

func pathWithin(root, candidate string) bool {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	candidateAbs, err := filepath.Abs(candidate)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(rootAbs, candidateAbs)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) && !filepath.IsAbs(rel)
}
