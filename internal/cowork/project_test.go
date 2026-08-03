package cowork

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCreateAndLoadProject(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	fixed := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return fixed }

	created, err := store.Create(root, "Northwing")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if created.ID == "" {
		t.Fatal("Create() returned an empty project id")
	}
	if created.Name != "Northwing" {
		t.Fatalf("Create() name = %q, want Northwing", created.Name)
	}
	if !created.CreatedAt.Equal(fixed) || !created.UpdatedAt.Equal(fixed) {
		t.Fatalf("Create() timestamps = %v/%v, want %v", created.CreatedAt, created.UpdatedAt, fixed)
	}
	if _, err := os.Stat(ManifestPath(root)); err != nil {
		t.Fatalf("manifest was not written: %v", err)
	}

	loaded, err := store.Load(root)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.ID != created.ID || loaded.Name != created.Name {
		t.Fatalf("Load() = %#v, want id/name from %#v", loaded, created)
	}
	if loaded.Workspace == "" || !filepath.IsAbs(loaded.Workspace) {
		t.Fatalf("Load() workspace = %q, want an absolute path", loaded.Workspace)
	}

	if _, err := store.Create(root, "Duplicate"); !errors.Is(err, ErrProjectExists) {
		t.Fatalf("second Create() error = %v, want ErrProjectExists", err)
	}
}

func TestLinkWorkReusesSessionReference(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}

	project, err := store.LinkWork(root, WorkRef{
		Title:       "First title",
		SessionPath: "sessions/one.jsonl",
		GoalID:      "goal-1",
	})
	if err != nil {
		t.Fatalf("LinkWork() error = %v", err)
	}
	if len(project.Works) != 1 {
		t.Fatalf("LinkWork() work count = %d, want 1", len(project.Works))
	}
	if project.Works[0].Profile != "balanced" {
		t.Fatalf("default profile = %q, want balanced", project.Works[0].Profile)
	}
	originalID := project.Works[0].ID

	project, err = store.LinkWork(root, WorkRef{
		Title:       "Updated title",
		SessionPath: "sessions/one.jsonl",
		GoalID:      "goal-1",
		Profile:     "delivery",
	})
	if err != nil {
		t.Fatalf("second LinkWork() error = %v", err)
	}
	if len(project.Works) != 1 {
		t.Fatalf("second LinkWork() work count = %d, want 1", len(project.Works))
	}
	if project.Works[0].ID != originalID {
		t.Fatalf("second LinkWork() id = %q, want %q", project.Works[0].ID, originalID)
	}
	if project.Works[0].Title != "Updated title" || project.Works[0].Profile != "delivery" {
		t.Fatalf("second LinkWork() = %#v", project.Works[0])
	}
}

func TestLinkWorkRejectsUnknownProfile(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	_, err := store.LinkWork(root, WorkRef{Title: "Work", Profile: "maximum"})
	if !errors.Is(err, ErrUnsupportedRuntimeProfile) {
		t.Fatalf("LinkWork() error = %v, want ErrUnsupportedRuntimeProfile", err)
	}
}

func TestRegisterArtifactCreatesVersions(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	outputDir := filepath.Join(root, "deliverables")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		t.Fatal(err)
	}
	output := filepath.Join(outputDir, "report.docx")
	if err := os.WriteFile(output, []byte("version one"), 0o600); err != nil {
		t.Fatal(err)
	}

	project, err := store.RegisterArtifact(root, Artifact{Path: output, WorkID: "work-1"})
	if err != nil {
		t.Fatalf("RegisterArtifact() error = %v", err)
	}
	if len(project.Artifacts) != 1 {
		t.Fatalf("artifact count = %d, want 1", len(project.Artifacts))
	}
	first := project.Artifacts[0]
	if first.Path != "deliverables/report.docx" || first.Kind != "docx" || first.Version != 1 {
		t.Fatalf("first artifact = %#v", first)
	}
	if first.SHA256 == "" || first.Size != int64(len("version one")) {
		t.Fatalf("first artifact hash/size = %q/%d", first.SHA256, first.Size)
	}

	if err := os.WriteFile(output, []byte("version two"), 0o600); err != nil {
		t.Fatal(err)
	}
	project, err = store.RegisterArtifact(root, Artifact{Path: "deliverables/report.docx", WorkID: "work-1"})
	if err != nil {
		t.Fatalf("second RegisterArtifact() error = %v", err)
	}
	if len(project.Artifacts) != 2 {
		t.Fatalf("artifact count = %d, want 2", len(project.Artifacts))
	}
	second := project.Artifacts[1]
	if second.Version != 2 {
		t.Fatalf("second artifact version = %d, want 2", second.Version)
	}
	if second.SHA256 == first.SHA256 {
		t.Fatal("artifact digest did not change after file contents changed")
	}
}

func TestRegisterArtifactRejectsOutsideWorkspace(t *testing.T) {
	root := t.TempDir()
	outsideRoot := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(outsideRoot, "report.pdf")
	if err := os.WriteFile(outside, []byte("pdf"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := store.RegisterArtifact(root, Artifact{Path: outside})
	if !errors.Is(err, ErrArtifactOutsideWorkspace) {
		t.Fatalf("RegisterArtifact() error = %v, want ErrArtifactOutsideWorkspace", err)
	}
}
