package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"reasonix/internal/agent"
	"reasonix/internal/cowork"
)

func TestNativeWorkMigratorBindsSessionIdentity(t *testing.T) {
	root := writeV2Fixture(t)
	migrator := NewNativeWorkMigrator(cowork.NewStore())
	project, err := migrator.EnsureProjectBindings(root)
	if err != nil {
		t.Fatalf("EnsureProjectBindings: %v", err)
	}
	if len(project.Works) != 1 {
		t.Fatalf("works = %d, want 1", len(project.Works))
	}
	work := project.Works[0]
	if work.BindingStatus != cowork.BindingStatusNative {
		t.Fatalf("BindingStatus = %q, want native", work.BindingStatus)
	}

	sessionPath := filepath.Join(root, "session", "topic-1.jsonl")
	kind, workID, err := agent.LoadSessionIdentity(sessionPath)
	if err != nil {
		t.Fatalf("LoadSessionIdentity: %v", err)
	}
	if kind != agent.SessionKindWork || workID != "work-v2-001" {
		t.Fatalf("identity = %q/%q, want work/work-v2-001", kind, workID)
	}
}

func TestNativeWorkMigratorIsIdempotent(t *testing.T) {
	root := writeV2Fixture(t)
	migrator := NewNativeWorkMigrator(cowork.NewStore())
	if _, err := migrator.EnsureProjectBindings(root); err != nil {
		t.Fatalf("first: %v", err)
	}
	firstMeta, err := os.ReadFile(filepath.Join(root, "session", "topic-1.jsonl.meta"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := migrator.EnsureProjectBindings(root); err != nil {
		t.Fatalf("second: %v", err)
	}
	secondMeta, err := os.ReadFile(filepath.Join(root, "session", "topic-1.jsonl.meta"))
	if err != nil {
		t.Fatal(err)
	}
	if string(firstMeta) != string(secondMeta) {
		t.Fatalf("second migration changed sidecar")
	}
}

func TestNativeWorkMigratorMarksAmbiguousSessionNeedsRebind(t *testing.T) {
	root := writeV2Fixture(t)
	// The WorkRef has sessionPath=session/topic-1.jsonl and goalId=topic-1.
	// Create a second existing session at the conventional goalId path so both
	// resolution strategies match different files.
	duplicate := filepath.Join(root, "session", "topic-1-conventional.jsonl")
	if err := os.WriteFile(duplicate, []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	// Rewrite the manifest so SessionPath points to the duplicate while goalId
	// still resolves to the original file.
	manifestPath := filepath.Join(root, ".northwing", "project.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	rewritten := strings.Replace(string(data), `"sessionPath": "session/topic-1.jsonl"`, `"sessionPath": "session/topic-1-conventional.jsonl"`, 1)
	if err := os.WriteFile(manifestPath, []byte(rewritten), 0o600); err != nil {
		t.Fatal(err)
	}
	migrator := NewNativeWorkMigrator(cowork.NewStore())
	project, err := migrator.EnsureProjectBindings(root)
	if err != nil {
		t.Fatalf("EnsureProjectBindings: %v", err)
	}
	if project.Works[0].BindingStatus != cowork.BindingStatusNeedsRebind {
		t.Fatalf("BindingStatus = %q, want needs_rebind", project.Works[0].BindingStatus)
	}
}

func TestNativeWorkMigratorRejectsConflictingWorkID(t *testing.T) {
	root := writeV2Fixture(t)
	sessionPath := filepath.Join(root, "session", "topic-1.jsonl")
	if err := agent.SetSessionIdentity(sessionPath, agent.SessionKindWork, "other-work"); err != nil {
		t.Fatal(err)
	}
	migrator := NewNativeWorkMigrator(cowork.NewStore())
	project, err := migrator.EnsureProjectBindings(root)
	if err != nil {
		t.Fatalf("EnsureProjectBindings: %v", err)
	}
	if project.Works[0].BindingStatus != cowork.BindingStatusNeedsRebind {
		t.Fatalf("BindingStatus = %q, want needs_rebind", project.Works[0].BindingStatus)
	}
}

func TestNativeWorkMigratorPreservesArtifactHashAndVersion(t *testing.T) {
	root := writeV2Fixture(t)
	if _, err := NewNativeWorkMigrator(cowork.NewStore()).EnsureProjectBindings(root); err != nil {
		t.Fatalf("EnsureProjectBindings: %v", err)
	}
	project, err := cowork.NewStore().Load(root)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(project.Artifacts) != 1 || project.Artifacts[0].Version != 3 {
		t.Fatalf("artifact drift = %#v", project.Artifacts)
	}
}

func writeV2Fixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	meta := filepath.Join(root, ".northwing")
	sessionDir := filepath.Join(root, "session")
	if err := os.MkdirAll(meta, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(sessionDir, 0o700); err != nil {
		t.Fatal(err)
	}
	project := `{
  "version": 2,
  "id": "proj-v2-001",
  "name": "V2 Migration Fixture",
  "createdAt": "2026-07-15T00:00:00Z",
  "updatedAt": "2026-07-15T00:00:00Z",
  "works": [{
    "id": "work-v2-001",
    "title": "Legacy 0.2 Work",
    "sessionPath": "session/topic-1.jsonl",
    "goalId": "topic-1",
    "profile": "delivery",
    "kind": "report",
    "quality": "standard",
    "sourcePolicy": "project_plus_web",
    "modelRef": "deepseek/deepseek-v4-flash",
    "reasoningEffort": "high",
    "harnessVersion": 2,
    "stage": "planning",
    "completedCriteria": 1,
    "totalCriteria": 4,
    "createdAt": "2026-07-15T00:00:00Z",
    "updatedAt": "2026-07-15T00:00:00Z"
  }],
  "artifacts": [{
    "id": "art-v2-001",
    "path": "deliverables/work-v2-001/report.docx",
    "kind": "docx",
    "workId": "work-v2-001",
    "version": 3,
    "sha256": "a3f5c8e9d2b1a3f5c8e9d2b1a3f5c8e9d2b1a3f5c8e9d2b1a3f5c8e9d2b1a3f5",
    "size": 18432,
    "createdAt": "2026-07-15T00:00:00Z"
  }]
}`
	if err := os.WriteFile(filepath.Join(meta, "project.json"), []byte(project), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "session", "topic-1.jsonl"), []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	metaObj := map[string]any{
		"id":             "topic-1",
		"name":           "Legacy 0.2 Work",
		"created_at":     "2026-07-15T00:00:00Z",
		"updated_at":     "2026-07-15T00:00:00Z",
		"scope":          "project",
		"workspace_root": root,
		"topic_id":       "topic-1",
		"topic_title":    "Legacy 0.2 Work",
	}
	metaContent, err := json.Marshal(metaObj)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "session", "topic-1.jsonl.meta"), metaContent, 0o600); err != nil {
		t.Fatal(err)
	}
	return root
}
