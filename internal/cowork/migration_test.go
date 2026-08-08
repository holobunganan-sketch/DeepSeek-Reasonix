package cowork

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadMigratesV1ManifestWithBackup(t *testing.T) {
	root := t.TempDir()
	meta := filepath.Join(root, MetadataDirName)
	if err := os.MkdirAll(meta, 0o700); err != nil {
		t.Fatal(err)
	}
	legacy := `{
  "version": 1,
  "id": "project-1",
  "name": "Legacy",
  "createdAt": "2026-08-05T00:00:00Z",
  "updatedAt": "2026-08-05T00:00:00Z",
  "works": [{
    "id": "work-1",
    "title": "Legacy work",
    "sessionPath": "sessions/legacy.jsonl",
    "goalId": "topic-legacy",
    "profile": "delivery",
    "createdAt": "2026-08-05T00:00:00Z",
    "updatedAt": "2026-08-05T00:00:00Z"
  }]
}`
	manifest := filepath.Join(meta, ManifestFileName)
	if err := os.WriteFile(manifest, []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}

	project, err := NewStore().Load(root)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if project.Version != ManifestVersion || ManifestVersion != 2 {
		t.Fatalf("version = %d, ManifestVersion = %d, want 2", project.Version, ManifestVersion)
	}
	if len(project.Works) != 1 || project.Works[0].Stage != WorkStageIntake {
		t.Fatalf("migrated work = %#v", project.Works)
	}
	backup := filepath.Join(meta, LegacyManifestBackupFileName)
	backupData, err := os.ReadFile(backup)
	if err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if string(backupData) != legacy {
		t.Fatalf("backup changed legacy bytes\n got: %q\nwant: %q", backupData, legacy)
	}
	var persisted Project
	data, err := os.ReadFile(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &persisted); err != nil {
		t.Fatal(err)
	}
	if persisted.Version != 2 {
		t.Fatalf("persisted version = %d, want 2", persisted.Version)
	}
}

func TestLoadMigrationIsIdempotent(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	manifest := ManifestPath(root)
	data, err := os.ReadFile(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Load(root); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Load(root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, MetadataDirName, LegacyManifestBackupFileName)); !os.IsNotExist(err) {
		t.Fatalf("current manifest unexpectedly produced legacy backup: %v", err)
	}
	after, err := os.ReadFile(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(data) {
		t.Fatal("loading a current manifest rewrote it")
	}
}

func TestProjectSummaryIncludesCompactWorks(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LinkWork(root, WorkRef{
		ID:                "work-1",
		Title:             "Native Work",
		GoalID:            "topic-1",
		Profile:           "delivery",
		Stage:             WorkStageReviewing,
		CompletedCriteria: 3,
		TotalCriteria:     5,
	}); err != nil {
		t.Fatal(err)
	}
	summaries := store.Summaries([]string{root})
	if len(summaries) != 1 || len(summaries[0].Works) != 1 {
		t.Fatalf("summaries = %#v", summaries)
	}
	work := summaries[0].Works[0]
	if work.GoalID != "topic-1" || work.Stage != WorkStageReviewing || work.CompletedCriteria != 3 || work.TotalCriteria != 5 {
		t.Fatalf("compact work = %#v", work)
	}
}

func TestLinkWorkPreservesDurableProgressWhenBindingIsRefreshed(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LinkWork(root, WorkRef{
		ID:                "work-1",
		Title:             "Native Work",
		GoalID:            "topic-1",
		Profile:           "delivery",
		Stage:             WorkStageReviewing,
		CompletedCriteria: 3,
		TotalCriteria:     5,
	}); err != nil {
		t.Fatal(err)
	}
	project, err := store.LinkWork(root, WorkRef{
		ID:          "work-1",
		Title:       "Native Work",
		SessionPath: "sessions/refreshed.jsonl",
		GoalID:      "topic-1",
		Profile:     "delivery",
	})
	if err != nil {
		t.Fatal(err)
	}
	work := project.Works[0]
	if work.Stage != WorkStageReviewing || work.CompletedCriteria != 3 || work.TotalCriteria != 5 {
		t.Fatalf("refreshed work lost progress: %#v", work)
	}
}

func TestUpdateWorkProgressPersistsValidatedStageAndAcceptance(t *testing.T) {
	root := t.TempDir()
	store := NewStore()
	if _, err := store.Create(root, "Project"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LinkWork(root, WorkRef{ID: "work-1", Title: "Native Work", Profile: "delivery", TotalCriteria: 4}); err != nil {
		t.Fatal(err)
	}
	project, err := store.UpdateWorkProgress(root, "work-1", string(WorkStageValidating), 3, 4)
	if err != nil {
		t.Fatal(err)
	}
	work := project.Works[0]
	if work.Stage != WorkStageValidating || work.CompletedCriteria != 3 || work.TotalCriteria != 4 {
		t.Fatalf("progress = %#v", work)
	}
	if _, err := store.UpdateWorkProgress(root, "work-1", string(WorkStageCompleted), 5, 4); !errors.Is(err, ErrInvalidAcceptanceProgress) {
		t.Fatalf("invalid acceptance error = %v", err)
	}
}
