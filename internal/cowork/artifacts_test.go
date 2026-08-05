package cowork

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSyncArtifactsRejectsOutputDirectorySymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Northwing test"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LinkWork(root, WorkRef{ID: "work123", Title: "Build report", Profile: "delivery"}); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "report.docx"), []byte("outside"), 0o600); err != nil {
		t.Fatal(err)
	}
	deliverables := filepath.Join(root, "deliverables")
	if err := os.MkdirAll(deliverables, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(deliverables, "work123")); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}

	_, err := store.SyncArtifacts(root)
	if !errors.Is(err, ErrArtifactOutsideWorkspace) {
		t.Fatalf("SyncArtifacts() error = %v, want ErrArtifactOutsideWorkspace", err)
	}
}

func TestSyncArtifactsIsIncremental(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	clock := time.Date(2026, 8, 3, 15, 0, 0, 0, time.UTC)
	store.now = func() time.Time {
		clock = clock.Add(time.Second)
		return clock
	}

	if _, err := store.Create(root, "Northwing test"); err != nil {
		t.Fatal(err)
	}
	project, err := store.LinkWork(root, WorkRef{ID: "work123", Title: "Build report", Profile: "delivery"})
	if err != nil {
		t.Fatal(err)
	}
	if len(project.Works) != 1 || project.Works[0].ID != "work123" {
		t.Fatalf("unexpected works: %#v", project.Works)
	}

	outputDir := filepath.Join(root, filepath.FromSlash(WorkOutputDir("work123")))
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		t.Fatal(err)
	}
	report := filepath.Join(outputDir, "report.docx")
	if err := os.WriteFile(report, []byte("version one"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outputDir, ".draft.tmp"), []byte("skip"), 0o600); err != nil {
		t.Fatal(err)
	}

	project, err = store.SyncArtifacts(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(project.Artifacts) != 1 {
		t.Fatalf("first sync artifacts = %d, want 1", len(project.Artifacts))
	}
	first := project.Artifacts[0]
	if first.WorkID != "work123" || first.Path != "deliverables/work123/report.docx" || first.Version != 1 {
		t.Fatalf("unexpected first artifact: %#v", first)
	}

	project, err = store.SyncArtifacts(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(project.Artifacts) != 1 {
		t.Fatalf("unchanged sync artifacts = %d, want 1", len(project.Artifacts))
	}

	if err := os.WriteFile(report, []byte("version two"), 0o600); err != nil {
		t.Fatal(err)
	}
	project, err = store.SyncArtifacts(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(project.Artifacts) != 2 {
		t.Fatalf("changed sync artifacts = %d, want 2", len(project.Artifacts))
	}
	second := project.Artifacts[1]
	if second.Version != 2 || second.SHA256 == first.SHA256 {
		t.Fatalf("unexpected second artifact: %#v", second)
	}

	if err := os.WriteFile(report, []byte("version one"), 0o600); err != nil {
		t.Fatal(err)
	}
	project, err = store.SyncArtifacts(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(project.Artifacts) != 2 {
		t.Fatalf("known content sync artifacts = %d, want 2", len(project.Artifacts))
	}
}

func TestProjectStateAndFinalArtifact(t *testing.T) {
	root := t.TempDir()
	store := NewStore()

	missing := store.State(root, true)
	if missing.Exists || missing.Project != nil || missing.Error != "" {
		t.Fatalf("missing state = %#v", missing)
	}

	if _, err := store.Create(root, "Northwing test"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LinkWork(root, WorkRef{ID: "work456", Title: "Prepare deck", Profile: "delivery"}); err != nil {
		t.Fatal(err)
	}
	outputDir := filepath.Join(root, filepath.FromSlash(WorkOutputDir("work456")))
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outputDir, "deck.pptx"), []byte("deck"), 0o600); err != nil {
		t.Fatal(err)
	}

	state := store.State(root, true)
	if !state.Exists || state.Project == nil || state.Error != "" {
		t.Fatalf("state = %#v", state)
	}
	if len(state.Project.Artifacts) != 1 {
		t.Fatalf("artifacts = %d, want 1", len(state.Project.Artifacts))
	}
	artifactID := state.Project.Artifacts[0].ID
	state, err := store.SetFinalArtifact(root, artifactID)
	if err != nil {
		t.Fatal(err)
	}
	if got := state.FinalArtifacts["work456"]; got != artifactID {
		t.Fatalf("final artifact = %q, want %q", got, artifactID)
	}

	reloaded := store.State(root, false)
	if got := reloaded.FinalArtifacts["work456"]; got != artifactID {
		t.Fatalf("reloaded final artifact = %q, want %q", got, artifactID)
	}
}

func TestSetFinalArtifactRejectsUnknownID(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Northwing test"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SetFinalArtifact(root, "missing"); err == nil {
		t.Fatal("SetFinalArtifact should reject unknown IDs")
	}
}
