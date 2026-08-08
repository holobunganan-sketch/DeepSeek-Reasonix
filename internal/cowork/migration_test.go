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
	if project.Version != ManifestVersion || ManifestVersion != 3 {
		t.Fatalf("version = %d, ManifestVersion = %d, want 3", project.Version, ManifestVersion)
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
	if persisted.Version != 3 {
		t.Fatalf("persisted version = %d, want 3", persisted.Version)
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

func TestLoadMigratesV2ManifestWithBackup(t *testing.T) {
	root := copyTestdata(t, "v2-project")
	meta := filepath.Join(root, MetadataDirName)
	manifest := filepath.Join(meta, ManifestFileName)
	legacy, err := os.ReadFile(manifest)
	if err != nil {
		t.Fatal(err)
	}

	project, err := NewStore().Load(root)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if project.Version != ManifestVersion || ManifestVersion != 3 {
		t.Fatalf("version = %d, ManifestVersion = %d, want 3", project.Version, ManifestVersion)
	}
	if len(project.Works) != 1 {
		t.Fatalf("works = %d, want 1", len(project.Works))
	}
	work := project.Works[0]
	if work.ID != "work-v2-001" {
		t.Fatalf("Work ID = %q, want work-v2-001", work.ID)
	}
	if work.HarnessVersion != CurrentHarnessVersion {
		t.Fatalf("HarnessVersion = %d, want %d", work.HarnessVersion, CurrentHarnessVersion)
	}
	if work.Stage != WorkStageIntake {
		t.Fatalf("Stage = %q, want intake", work.Stage)
	}
	if len(work.HarnessSteps) == 0 || work.HarnessSteps[0] != HarnessStepInventory {
		t.Fatalf("HarnessSteps = %v", work.HarnessSteps)
	}
	if work.BindingStatus != BindingStatusNeedsRebind {
		t.Fatalf("BindingStatus = %q, want needs_rebind", work.BindingStatus)
	}
	if len(project.Artifacts) != 1 || project.Artifacts[0].SHA256 != "a3f5c8e9d2b1a3f5c8e9d2b1a3f5c8e9d2b1a3f5c8e9d2b1a3f5c8e9d2b1a3f5" {
		t.Fatalf("artifact preserved = %#v", project.Artifacts)
	}
	backup := filepath.Join(meta, V2ManifestBackupFileName)
	backupData, err := os.ReadFile(backup)
	if err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if string(backupData) != string(legacy) {
		t.Fatalf("backup changed legacy bytes\n got: %q\nwant: %q", backupData, legacy)
	}
}

func TestLoadV2MigrationIsIdempotent(t *testing.T) {
	root := copyTestdata(t, "v2-project")
	store := NewStore()
	if _, err := store.Load(root); err != nil {
		t.Fatalf("first Load: %v", err)
	}
	first, err := os.ReadFile(filepath.Join(root, MetadataDirName, ManifestFileName))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Load(root); err != nil {
		t.Fatalf("second Load: %v", err)
	}
	second, err := os.ReadFile(filepath.Join(root, MetadataDirName, ManifestFileName))
	if err != nil {
		t.Fatal(err)
	}
	if string(first) != string(second) {
		t.Fatalf("second migration changed manifest\nfirst: %q\nsecond: %q", first, second)
	}
}

func TestLoadV2MigrationLeavesSessionBytesUnchanged(t *testing.T) {
	root := copyTestdata(t, "v2-project")
	sessionPath := filepath.Join(root, "session", "topic-1.jsonl")
	before, err := os.ReadFile(sessionPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewStore().Load(root); err != nil {
		t.Fatalf("Load: %v", err)
	}
	after, err := os.ReadFile(sessionPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatalf("session bytes changed")
	}
}

func copyTestdata(t *testing.T, name string) string {
	t.Helper()
	src := filepath.Join("testdata", name)
	dst := t.TempDir()
	if err := copyDir(src, dst); err != nil {
		t.Fatalf("copy testdata %s: %v", name, err)
	}
	return dst
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o600)
	})
}
