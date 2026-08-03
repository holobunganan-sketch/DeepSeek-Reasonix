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
