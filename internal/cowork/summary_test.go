package cowork

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSummariesKeepOrdinaryReasonixWorkspacesOptional(t *testing.T) {
	store := NewStore()
	root := t.TempDir()

	summaries := store.Summaries([]string{root, root, ""})
	if len(summaries) != 1 {
		t.Fatalf("Summaries returned %d rows, want 1", len(summaries))
	}
	if summaries[0].Exists {
		t.Fatal("ordinary Reasonix workspace should not be reported as a Northwing project")
	}
	if summaries[0].Error != "" {
		t.Fatalf("missing manifest should not be an error: %s", summaries[0].Error)
	}
}

func TestCatalogIsEmptyForOrdinaryWorkspaces(t *testing.T) {
	store := NewStore()
	root := t.TempDir()

	catalog, err := store.Catalog([]string{root, "", root})
	if err != nil {
		t.Fatalf("Catalog returned error for optional workspace: %v", err)
	}
	if len(catalog.Projects) != 1 || catalog.Projects[0].Exists {
		t.Fatalf("ordinary workspace should appear as non-existent project: %#v", catalog.Projects)
	}
	if len(catalog.Works) != 0 || len(catalog.ActiveWorks) != 0 || len(catalog.WaitingForUser) != 0 || len(catalog.RecentArtifacts) != 0 {
		t.Fatalf("ordinary workspace should produce no works or artifacts: %#v", catalog)
	}
}

func TestCatalogSurfacesActiveWorksWaitingAndRecentArtifacts(t *testing.T) {
	store := NewStore()
	clock := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return clock }
	root := t.TempDir()

	if _, err := store.Create(root, "Medical strategy"); err != nil {
		t.Fatal(err)
	}

	clock = clock.Add(time.Minute)
	first, err := store.LinkWork(root, WorkRef{
		Title:       "Draft report",
		SessionPath: "session-a",
		Profile:     "delivery",
		Stage:       WorkStagePlanning,
	})
	if err != nil {
		t.Fatal(err)
	}

	clock = clock.Add(time.Minute)
	second, err := store.LinkWork(root, WorkRef{
		Title:       "Build slides",
		SessionPath: "session-b",
		Profile:     "delivery",
		Stage:       WorkStageWaitingUser,
	})
	if err != nil {
		t.Fatal(err)
	}

	clock = clock.Add(time.Minute)
	completed, err := store.LinkWork(root, WorkRef{
		Title:       "Archive old data",
		SessionPath: "session-c",
		Profile:     "delivery",
		Stage:       WorkStageCompleted,
	})
	if err != nil {
		t.Fatal(err)
	}

	clock = clock.Add(time.Minute)
	failed, err := store.LinkWork(root, WorkRef{
		Title:       "Import archive",
		SessionPath: "session-d",
		Profile:     "delivery",
		Stage:       WorkStageFailed,
	})
	if err != nil {
		t.Fatal(err)
	}

	artifactPath := filepath.Join(root, "deliverables", "brief.pdf")
	if err := os.MkdirAll(filepath.Dir(artifactPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(artifactPath, []byte("brief"), 0o600); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(time.Minute)
	withArtifact, err := store.RegisterArtifact(root, Artifact{Path: artifactPath, Kind: "pdf", WorkID: second.Works[1].ID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.SetFinalArtifact(root, withArtifact.Artifacts[len(withArtifact.Artifacts)-1].ID); err != nil {
		t.Fatal(err)
	}

	catalog, err := store.Catalog([]string{root})
	if err != nil {
		t.Fatal(err)
	}

	if len(catalog.Projects) != 1 || !catalog.Projects[0].Exists {
		t.Fatalf("expected one existing project: %#v", catalog.Projects)
	}

	if len(catalog.Works) != 4 {
		t.Fatalf("expected all 4 works, got %d: %#v", len(catalog.Works), catalog.Works)
	}
	if catalog.Works[0].WorkID != failed.Works[3].ID || catalog.Works[1].WorkID != completed.Works[2].ID {
		t.Fatalf("terminal works should be present in newest-first order: %#v", catalog.Works)
	}
	if len(catalog.ActiveWorks) != 1 {
		t.Fatalf("expected 1 active work, got %d: %#v", len(catalog.ActiveWorks), catalog.ActiveWorks)
	}
	if catalog.ActiveWorks[0].WorkID != first.Works[0].ID {
		t.Fatalf("active projection should exclude waiting and terminal works: %#v", catalog.ActiveWorks)
	}
	if catalog.ActiveWorks[0].SessionKind != "work" {
		t.Fatalf("active work should expose sessionKind=work: %#v", catalog.ActiveWorks[0])
	}
	if catalog.ActiveWorks[0].Stage != WorkStagePlanning {
		t.Fatalf("active work stage mismatch: %#v", catalog.ActiveWorks[0])
	}

	if len(catalog.WaitingForUser) != 1 || catalog.WaitingForUser[0].WorkID != second.Works[1].ID {
		t.Fatalf("expected one waiting work: %#v", catalog.WaitingForUser)
	}

	if len(catalog.RecentArtifacts) != 1 {
		t.Fatalf("expected 1 recent artifact, got %d: %#v", len(catalog.RecentArtifacts), catalog.RecentArtifacts)
	}
	artifact := catalog.RecentArtifacts[0]
	if !artifact.Final {
		t.Fatalf("artifact should be marked final: %#v", artifact)
	}
	if artifact.WorkID != second.Works[1].ID {
		t.Fatalf("artifact work id mismatch: %#v", artifact)
	}

	_ = first
	_ = completed
	_ = failed
}

func TestSummariesReturnCompactLatestActivity(t *testing.T) {
	store := NewStore()
	clock := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	store.now = func() time.Time { return clock }
	root := t.TempDir()

	if _, err := store.Create(root, "Medical strategy"); err != nil {
		t.Fatal(err)
	}
	first, err := store.LinkWork(root, WorkRef{Title: "Draft report", SessionPath: "session-a", Profile: "delivery"})
	if err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(time.Minute)
	second, err := store.LinkWork(root, WorkRef{Title: "Build slides", SessionPath: "session-b", Profile: "delivery"})
	if err != nil {
		t.Fatal(err)
	}

	artifactPath := filepath.Join(root, "deliverables", "brief.pdf")
	if err := os.MkdirAll(filepath.Dir(artifactPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(artifactPath, []byte("brief"), 0o600); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(time.Minute)
	if _, err := store.RegisterArtifact(root, Artifact{Path: artifactPath, Kind: "pdf", WorkID: second.Works[1].ID}); err != nil {
		t.Fatal(err)
	}

	summaries := store.Summaries([]string{root})
	if len(summaries) != 1 {
		t.Fatalf("Summaries returned %d rows, want 1", len(summaries))
	}
	summary := summaries[0]
	if !summary.Exists || summary.Name != "Medical strategy" {
		t.Fatalf("unexpected summary: %#v", summary)
	}
	if summary.WorkCount != 2 || summary.ArtifactCount != 1 {
		t.Fatalf("unexpected counts: works=%d artifacts=%d", summary.WorkCount, summary.ArtifactCount)
	}
	if summary.LatestWork == nil || summary.LatestWork.Title != "Build slides" {
		t.Fatalf("unexpected latest work: %#v; first project=%#v", summary.LatestWork, first)
	}
	if summary.LatestArtifact == nil || summary.LatestArtifact.Path != "deliverables/brief.pdf" {
		t.Fatalf("unexpected latest artifact: %#v", summary.LatestArtifact)
	}
}
