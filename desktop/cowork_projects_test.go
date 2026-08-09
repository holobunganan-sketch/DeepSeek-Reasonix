package main

import (
	"path/filepath"
	"testing"

	"reasonix/internal/cowork"
)

func TestNorthwingCatalogSurfacesWorksAndArtifacts(t *testing.T) {
	root := writeV2Fixture(t)

	app := &App{}
	catalog, err := app.NorthwingCatalog([]string{root})
	if err != nil {
		t.Fatalf("NorthwingCatalog: %v", err)
	}

	if len(catalog.Projects) != 1 || !catalog.Projects[0].Exists {
		t.Fatalf("expected one existing project: %#v", catalog.Projects)
	}

	if len(catalog.ActiveWorks) != 1 {
		t.Fatalf("expected 1 active work, got %d: %#v", len(catalog.ActiveWorks), catalog.ActiveWorks)
	}
	work := catalog.ActiveWorks[0]
	if work.WorkID != "work-v2-001" {
		t.Fatalf("unexpected work id: %q", work.WorkID)
	}
	if work.SessionKind != "work" {
		t.Fatalf("unexpected session kind: %q", work.SessionKind)
	}
	if work.Stage != "intake" {
		t.Fatalf("unexpected stage: %q", work.Stage)
	}

	if len(catalog.WaitingForUser) != 0 {
		t.Fatalf("expected no waiting works: %#v", catalog.WaitingForUser)
	}

	if len(catalog.RecentArtifacts) != 1 {
		t.Fatalf("expected 1 recent artifact, got %d: %#v", len(catalog.RecentArtifacts), catalog.RecentArtifacts)
	}
	artifact := catalog.RecentArtifacts[0]
	if artifact.WorkID != "work-v2-001" {
		t.Fatalf("unexpected artifact work id: %q", artifact.WorkID)
	}
	if artifact.Path != "deliverables/work-v2-001/report.docx" {
		t.Fatalf("unexpected artifact path: %q", artifact.Path)
	}
}

func TestNorthwingCatalogIgnoresEmptyAndDuplicateRoots(t *testing.T) {
	root := writeV2Fixture(t)

	app := &App{}
	catalog, err := app.NorthwingCatalog([]string{root, "", root})
	if err != nil {
		t.Fatalf("NorthwingCatalog: %v", err)
	}

	if len(catalog.Projects) != 1 {
		t.Fatalf("expected one project row after dedupe: %#v", catalog.Projects)
	}
}

func TestNorthwingCatalogMarksFinalArtifact(t *testing.T) {
	root := writeV2Fixture(t)

	app := &App{}
	if _, err := app.SetCoworkArtifactFinal(root, "art-v2-001"); err != nil {
		t.Fatalf("SetCoworkArtifactFinal: %v", err)
	}

	catalog, err := app.NorthwingCatalog([]string{root})
	if err != nil {
		t.Fatalf("NorthwingCatalog: %v", err)
	}

	if len(catalog.RecentArtifacts) != 1 {
		t.Fatalf("expected 1 recent artifact: %#v", catalog.RecentArtifacts)
	}
	if !catalog.RecentArtifacts[0].Final {
		t.Fatalf("artifact should be final: %#v", catalog.RecentArtifacts[0])
	}
}

func TestNorthwingCatalogLeavesMissingWorkspaceAsNonExistent(t *testing.T) {
	root := filepath.Join(t.TempDir(), "missing-project")

	app := &App{}
	catalog, err := app.NorthwingCatalog([]string{root})
	if err != nil {
		t.Fatalf("NorthwingCatalog: %v", err)
	}

	if len(catalog.Projects) != 1 || catalog.Projects[0].Exists {
		t.Fatalf("missing project should be non-existent: %#v", catalog.Projects)
	}
	if len(catalog.ActiveWorks) != 0 || len(catalog.RecentArtifacts) != 0 {
		t.Fatalf("missing project should produce no works or artifacts: %#v", catalog)
	}
}

func TestNorthwingCatalogSurfacesWaitingWork(t *testing.T) {
	root := writeV2Fixture(t)

	if _, err := cowork.NewStore().UpdateWorkProgress(root, "work-v2-001", string(cowork.WorkStageWaitingUser), 2, 4); err != nil {
		t.Fatalf("UpdateWorkProgress: %v", err)
	}

	app := &App{}
	catalog, err := app.NorthwingCatalog([]string{root})
	if err != nil {
		t.Fatalf("NorthwingCatalog: %v", err)
	}

	if len(catalog.WaitingForUser) != 1 {
		t.Fatalf("expected 1 waiting work: %#v", catalog.WaitingForUser)
	}
	if catalog.WaitingForUser[0].Stage != "waiting_user" {
		t.Fatalf("unexpected waiting stage: %q", catalog.WaitingForUser[0].Stage)
	}
}
