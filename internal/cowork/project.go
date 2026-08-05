package cowork

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"reasonix/internal/fileutil"
)

const (
	ManifestVersion  = 1
	MetadataDirName  = ".northwing"
	ManifestFileName = "project.json"
)

var (
	ErrProjectExists             = errors.New("cowork project already exists")
	ErrProjectNotFound           = errors.New("cowork project not found")
	ErrUnsupportedManifest       = errors.New("unsupported cowork manifest version")
	ErrInvalidWorkID             = errors.New("invalid cowork work id")
	ErrArtifactOutsideWorkspace  = errors.New("artifact is outside the project workspace")
	ErrArtifactIsNotRegularFile  = errors.New("artifact is not a regular file")
	ErrUnsupportedRuntimeProfile = errors.New("unsupported Reasonix runtime profile")
)

// Project is a thin CoWork index over existing Reasonix resources. It links
// sessions, goals, and deliverables without copying their content or duplicating
// Reasonix runtime state.
type Project struct {
	Version   int        `json:"version"`
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	Works     []WorkRef  `json:"works,omitempty"`
	Artifacts []Artifact `json:"artifacts,omitempty"`
	Workspace string     `json:"-"`
}

// WorkRef links one Northwing work item to the Reasonix session and Goal that
// remain the authoritative execution state. No second task state machine lives
// in the project manifest.
type WorkRef struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	SessionPath string    `json:"sessionPath,omitempty"`
	GoalID      string    `json:"goalId,omitempty"`
	Profile     string    `json:"profile"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Artifact records a versioned file produced by a work item. The path is always
// workspace-relative and slash-normalized so moving the whole project keeps the
// manifest valid.
type Artifact struct {
	ID        string    `json:"id"`
	Path      string    `json:"path"`
	Kind      string    `json:"kind"`
	WorkID    string    `json:"workId,omitempty"`
	Version   int       `json:"version"`
	SHA256    string    `json:"sha256"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"createdAt"`
}

// Store serializes manifest changes inside one process and publishes each
// update through Reasonix's existing atomic file writer.
type Store struct {
	mu  sync.Mutex
	now func() time.Time
}

func NewStore() *Store {
	return &Store{now: func() time.Time { return time.Now().UTC() }}
}

func ManifestPath(workspaceRoot string) string {
	return filepath.Join(workspaceRoot, MetadataDirName, ManifestFileName)
}

func (s *Store) Create(workspaceRoot, name string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	root, err := normalizeWorkspaceRoot(workspaceRoot)
	if err != nil {
		return Project{}, err
	}
	path := ManifestPath(root)
	if _, err := os.Stat(path); err == nil {
		return Project{}, fmt.Errorf("%w: %s", ErrProjectExists, path)
	} else if !os.IsNotExist(err) {
		return Project{}, fmt.Errorf("inspect project manifest: %w", err)
	}

	name = strings.TrimSpace(name)
	if name == "" {
		name = filepath.Base(root)
	}
	id, err := newID()
	if err != nil {
		return Project{}, err
	}
	now := s.now()
	project := Project{
		Version:   ManifestVersion,
		ID:        id,
		Name:      name,
		CreatedAt: now,
		UpdatedAt: now,
		Workspace: root,
	}
	data, err := marshalProject(project)
	if err != nil {
		return Project{}, err
	}
	if err := fileutil.AtomicCreateFile(path, data, 0o600); err != nil {
		if _, statErr := os.Stat(path); statErr == nil {
			return Project{}, fmt.Errorf("%w: %s", ErrProjectExists, path)
		}
		return Project{}, fmt.Errorf("create project manifest: %w", err)
	}
	return project, nil
}

func (s *Store) Load(workspaceRoot string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadUnlocked(workspaceRoot)
}

// LinkWork creates or updates a project reference to an existing Reasonix
// session/Goal. An omitted profile resolves to Reasonix's balanced profile.
func (s *Store) LinkWork(workspaceRoot string, work WorkRef) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	project, err := s.loadUnlocked(workspaceRoot)
	if err != nil {
		return Project{}, err
	}
	profile, err := normalizeProfile(work.Profile)
	if err != nil {
		return Project{}, err
	}
	work.Title = strings.TrimSpace(work.Title)
	work.ID = strings.TrimSpace(work.ID)
	if work.ID != "" {
		if err := validateWorkID(work.ID); err != nil {
			return Project{}, err
		}
	}
	work.SessionPath = strings.TrimSpace(work.SessionPath)
	work.GoalID = strings.TrimSpace(work.GoalID)
	work.Profile = profile

	index := -1
	for i := range project.Works {
		if work.ID != "" && project.Works[i].ID == work.ID {
			index = i
			break
		}
		if work.ID == "" && work.SessionPath != "" && project.Works[i].SessionPath == work.SessionPath {
			index = i
			break
		}
	}
	now := s.now()
	if index >= 0 {
		current := project.Works[index]
		work.ID = current.ID
		work.CreatedAt = current.CreatedAt
		work.UpdatedAt = now
		project.Works[index] = work
	} else {
		if work.ID == "" {
			work.ID, err = newID()
			if err != nil {
				return Project{}, err
			}
		}
		if work.Title == "" {
			work.Title = "Untitled work"
		}
		work.CreatedAt = now
		work.UpdatedAt = now
		project.Works = append(project.Works, work)
	}
	project.UpdatedAt = now
	if err := writeProject(project); err != nil {
		return Project{}, err
	}
	return project, nil
}

// RegisterArtifact hashes a file inside the workspace and appends a new content
// version to the project manifest. A path/hash pair already in the manifest is
// returned unchanged; existing files are never copied into Northwing metadata.
func (s *Store) RegisterArtifact(workspaceRoot string, artifact Artifact) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	project, err := s.loadUnlocked(workspaceRoot)
	if err != nil {
		return Project{}, err
	}
	rel, full, info, err := resolveArtifact(project.Workspace, artifact.Path)
	if err != nil {
		return Project{}, err
	}
	digest, err := hashFile(full)
	if err != nil {
		return Project{}, err
	}
	artifact.WorkID = strings.TrimSpace(artifact.WorkID)
	if artifact.WorkID != "" {
		if err := validateWorkID(artifact.WorkID); err != nil {
			return Project{}, err
		}
	}
	version := 1
	for _, existing := range project.Artifacts {
		if existing.Path == rel && existing.SHA256 == digest {
			return project, nil
		}
		if existing.Path == rel && existing.Version >= version {
			version = existing.Version + 1
		}
	}
	id, err := newID()
	if err != nil {
		return Project{}, err
	}
	kind := strings.ToLower(strings.TrimSpace(artifact.Kind))
	if kind == "" {
		kind = strings.TrimPrefix(strings.ToLower(filepath.Ext(rel)), ".")
		if kind == "" {
			kind = "file"
		}
	}
	now := s.now()
	artifact = Artifact{
		ID:        id,
		Path:      rel,
		Kind:      kind,
		WorkID:    artifact.WorkID,
		Version:   version,
		SHA256:    digest,
		Size:      info.Size(),
		CreatedAt: now,
	}
	project.Artifacts = append(project.Artifacts, artifact)
	project.UpdatedAt = now
	if err := writeProject(project); err != nil {
		return Project{}, err
	}
	return project, nil
}

func (s *Store) loadUnlocked(workspaceRoot string) (Project, error) {
	root, err := normalizeWorkspaceRoot(workspaceRoot)
	if err != nil {
		return Project{}, err
	}
	path := ManifestPath(root)
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return Project{}, fmt.Errorf("%w: %s", ErrProjectNotFound, path)
	}
	if err != nil {
		return Project{}, fmt.Errorf("read project manifest: %w", err)
	}
	var project Project
	if err := json.Unmarshal(data, &project); err != nil {
		return Project{}, fmt.Errorf("decode project manifest: %w", err)
	}
	if project.Version != ManifestVersion {
		return Project{}, fmt.Errorf("%w: got %d, want %d", ErrUnsupportedManifest, project.Version, ManifestVersion)
	}
	if strings.TrimSpace(project.ID) == "" || strings.TrimSpace(project.Name) == "" {
		return Project{}, errors.New("invalid cowork project manifest: id and name are required")
	}
	if err := validateProjectReferences(project); err != nil {
		return Project{}, err
	}
	project.Workspace = root
	return project, nil
}

func writeProject(project Project) error {
	if err := validateProjectReferences(project); err != nil {
		return err
	}
	data, err := marshalProject(project)
	if err != nil {
		return err
	}
	if err := fileutil.AtomicWriteFileStrict(ManifestPath(project.Workspace), data, 0o600); err != nil {
		return fmt.Errorf("write project manifest: %w", err)
	}
	return nil
}

func marshalProject(project Project) ([]byte, error) {
	project.Workspace = ""
	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode project manifest: %w", err)
	}
	return append(data, '\n'), nil
}

func normalizeWorkspaceRoot(root string) (string, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return "", errors.New("workspace root is required")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("resolve workspace root: %w", err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", fmt.Errorf("inspect workspace root: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("workspace root is not a directory: %s", abs)
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", fmt.Errorf("resolve workspace root symlinks: %w", err)
	}
	return filepath.Clean(resolved), nil
}

func normalizeProfile(profile string) (string, error) {
	profile = strings.ToLower(strings.TrimSpace(profile))
	if profile == "" {
		return "balanced", nil
	}
	switch profile {
	case "economy", "balanced", "delivery":
		return profile, nil
	default:
		return "", fmt.Errorf("%w: %s", ErrUnsupportedRuntimeProfile, profile)
	}
}

func validateProjectReferences(project Project) error {
	for i, work := range project.Works {
		if err := validateWorkID(work.ID); err != nil {
			return fmt.Errorf("invalid cowork project manifest work %d: %w", i, err)
		}
	}
	for i, artifact := range project.Artifacts {
		if artifact.WorkID != "" {
			if err := validateWorkID(artifact.WorkID); err != nil {
				return fmt.Errorf("invalid cowork project manifest artifact %d work: %w", i, err)
			}
		}
		if err := validateStoredArtifactPath(artifact.Path); err != nil {
			return fmt.Errorf("invalid cowork project manifest artifact %d: %w", i, err)
		}
	}
	return nil
}

func validateWorkID(workID string) error {
	if workID == "" || workID != strings.TrimSpace(workID) || len(workID) > 128 {
		return fmt.Errorf("%w: %q", ErrInvalidWorkID, workID)
	}
	for i, char := range workID {
		if char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' {
			continue
		}
		if i > 0 && (char == '-' || char == '_' || char == '.') {
			continue
		}
		return fmt.Errorf("%w: %q", ErrInvalidWorkID, workID)
	}
	return nil
}

func validateStoredArtifactPath(artifactPath string) error {
	if artifactPath == "" || artifactPath != strings.TrimSpace(artifactPath) || strings.Contains(artifactPath, `\`) {
		return fmt.Errorf("%w: %s", ErrArtifactOutsideWorkspace, artifactPath)
	}
	if filepath.IsAbs(filepath.FromSlash(artifactPath)) || strings.HasPrefix(artifactPath, "/") {
		return fmt.Errorf("%w: %s", ErrArtifactOutsideWorkspace, artifactPath)
	}
	if len(artifactPath) >= 2 && ((artifactPath[0] >= 'a' && artifactPath[0] <= 'z') || (artifactPath[0] >= 'A' && artifactPath[0] <= 'Z')) && artifactPath[1] == ':' {
		return fmt.Errorf("%w: %s", ErrArtifactOutsideWorkspace, artifactPath)
	}
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(artifactPath)))
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || clean != artifactPath {
		return fmt.Errorf("%w: %s", ErrArtifactOutsideWorkspace, artifactPath)
	}
	return nil
}

func resolveArtifact(root, artifactPath string) (string, string, os.FileInfo, error) {
	artifactPath = strings.TrimSpace(artifactPath)
	if artifactPath == "" {
		return "", "", nil, errors.New("artifact path is required")
	}
	full := artifactPath
	if !filepath.IsAbs(full) {
		full = filepath.Join(root, full)
	}
	full, err := filepath.Abs(full)
	if err != nil {
		return "", "", nil, fmt.Errorf("resolve artifact path: %w", err)
	}
	resolved, err := filepath.EvalSymlinks(full)
	if err != nil {
		return "", "", nil, fmt.Errorf("resolve artifact path: %w", err)
	}
	rel, err := filepath.Rel(root, resolved)
	if err != nil {
		return "", "", nil, fmt.Errorf("relativize artifact path: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || filepath.IsAbs(rel) {
		return "", "", nil, fmt.Errorf("%w: %s", ErrArtifactOutsideWorkspace, artifactPath)
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return "", "", nil, fmt.Errorf("inspect artifact: %w", err)
	}
	if !info.Mode().IsRegular() {
		return "", "", nil, fmt.Errorf("%w: %s", ErrArtifactIsNotRegularFile, artifactPath)
	}
	return filepath.ToSlash(filepath.Clean(rel)), resolved, info, nil
}

func hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open artifact: %w", err)
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("hash artifact: %w", err)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func newID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", fmt.Errorf("generate cowork id: %w", err)
	}
	return hex.EncodeToString(raw[:]), nil
}
