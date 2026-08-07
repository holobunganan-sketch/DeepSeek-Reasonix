package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"reasonix/internal/agent"
	"reasonix/internal/control"
	"reasonix/internal/event"
)

func TestPinNewEmptySessionBranchMetaStoresBinding(t *testing.T) {
	isolateDesktopUserDirs(t)

	projectRoot := t.TempDir()
	tests := []struct {
		name          string
		scope         string
		workspaceRoot string
		topicID       string
		topicTitle    string
		wantRoot      string
	}{
		{
			name:          "project",
			scope:         "project",
			workspaceRoot: projectRoot,
			topicID:       "topic_project",
			topicTitle:    "Project topic",
			wantRoot:      normalizeProjectRoot(projectRoot),
		},
		{
			name:          "global",
			scope:         "global",
			workspaceRoot: globalWorkspaceRoot(),
			topicID:       "topic_global",
			topicTitle:    "Global topic",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path, err := createEmptySessionFile(t.TempDir(), "test-model")
			if err != nil {
				t.Fatalf("createEmptySessionFile: %v", err)
			}
			err = pinNewEmptySessionBranchMeta(
				path,
				tt.scope,
				tt.workspaceRoot,
				tt.topicID,
				tt.topicTitle,
			)
			if err != nil {
				t.Fatalf("pinNewEmptySessionBranchMeta: %v", err)
			}
			meta, ok, err := agent.LoadBranchMeta(path)
			if err != nil || !ok {
				t.Fatalf("LoadBranchMeta(%q): ok=%v err=%v", path, ok, err)
			}
			if meta.Scope != tt.scope ||
				meta.WorkspaceRoot != tt.wantRoot ||
				meta.TopicID != tt.topicID ||
				meta.TopicTitle != tt.topicTitle {
				t.Fatalf(
					"branch meta binding = scope %q root %q topic %q title %q, want %q %q %q %q",
					meta.Scope,
					meta.WorkspaceRoot,
					meta.TopicID,
					meta.TopicTitle,
					tt.scope,
					tt.wantRoot,
					tt.topicID,
					tt.topicTitle,
				)
			}
		})
	}
}

func TestEnsureWorkTabPersistsSessionIdentity(t *testing.T) {
	isolateDesktopUserDirs(t)

	app := NewApp()
	meta, err := app.EnsureWorkTab(t.TempDir(), "work-123")
	if err != nil {
		t.Fatalf("EnsureWorkTab: %v", err)
	}
	if meta.SessionKind != agent.SessionKindWork || meta.WorkID != "work-123" {
		t.Fatalf("tab identity = %q/%q", meta.SessionKind, meta.WorkID)
	}
	kind, workID, err := agent.LoadSessionIdentity(meta.SessionPath)
	if err != nil {
		t.Fatalf("LoadSessionIdentity: %v", err)
	}
	if kind != agent.SessionKindWork || workID != "work-123" {
		t.Fatalf("persisted identity = %q/%q", kind, workID)
	}
}

func TestEnsureWorkTabIsExcludedFromBlankChatSessionReuse(t *testing.T) {
	isolateDesktopUserDirs(t)

	root := t.TempDir()
	app := NewApp()
	work, err := app.EnsureWorkTab(root, "work-123")
	if err != nil {
		t.Fatalf("EnsureWorkTab: %v", err)
	}
	chat, err := app.EnsureBlankTab("project", root)
	if err != nil {
		t.Fatalf("EnsureBlankTab: %v", err)
	}
	if chat.ID == work.ID {
		t.Fatalf("blank chat reused Work tab %q", work.ID)
	}
	if chat.SessionKind != agent.SessionKindChat || chat.WorkID != "" {
		t.Fatalf("chat identity = %q/%q", chat.SessionKind, chat.WorkID)
	}
}

func TestNewSessionMetaResetsSessionIdentityToChat(t *testing.T) {
	isolateDesktopUserDirs(t)

	dir := t.TempDir()
	path := filepath.Join(dir, "work.jsonl")
	writeHistoryTestSession(t, path, "work prompt")
	if err := agent.SetSessionIdentity(path, agent.SessionKindWork, "work-123"); err != nil {
		t.Fatalf("SetSessionIdentity: %v", err)
	}
	loaded, err := agent.LoadSession(path)
	if err != nil {
		t.Fatalf("LoadSession: %v", err)
	}
	executor := agent.New(nil, nil, loaded, agent.Options{}, event.Discard)
	ctrl := control.New(control.Options{Executor: executor, SessionDir: dir, SessionPath: path, Label: "test", Sink: event.Discard})
	ctrl.Resume(loaded, path)
	defer ctrl.Close()

	app := NewApp()
	app.setTestCtrl(ctrl, "")
	tab := app.tabs["test"]
	tab.SessionPath = path
	tab.SessionKind = agent.SessionKindWork
	tab.WorkID = "work-123"
	if err := app.NewSessionForTab(tab.ID); err != nil {
		t.Fatalf("NewSessionForTab: %v", err)
	}
	meta := app.ListTabs()[0]
	if meta.SessionKind != agent.SessionKindChat || meta.WorkID != "" {
		t.Fatalf("rotated tab identity = %q/%q", meta.SessionKind, meta.WorkID)
	}
	if meta.SessionPath == path {
		t.Fatalf("new session kept old path %q", path)
	}
	kind, workID, err := agent.LoadSessionIdentity(meta.SessionPath)
	if err != nil {
		t.Fatalf("LoadSessionIdentity: %v", err)
	}
	if kind != agent.SessionKindChat || workID != "" {
		t.Fatalf("rotated persisted identity = %q/%q", kind, workID)
	}
}

func TestPinnedSessionMetaKeepsProjectBindingOutsideKnownDirectories(t *testing.T) {
	isolateDesktopUserDirs(t)

	projectRoot := t.TempDir()
	topicID := "topic_unknown_dir"
	topicTitle := "Unknown directory"
	sessionPath, err := createEmptySessionFile(t.TempDir(), "test-model")
	if err != nil {
		t.Fatalf("createEmptySessionFile: %v", err)
	}
	if err := pinNewEmptySessionBranchMeta(
		sessionPath,
		"project",
		projectRoot,
		topicID,
		topicTitle,
	); err != nil {
		t.Fatalf("pinNewEmptySessionBranchMeta: %v", err)
	}

	app := NewApp()
	tab := &WorkspaceTab{
		ID:            "tab_unknown_dir",
		Scope:         "project",
		WorkspaceRoot: projectRoot,
		TopicID:       topicID,
		TopicTitle:    topicTitle,
		SessionPath:   sessionPath,
		disabledMCP:   map[string]ServerView{},
	}
	app.tabs[tab.ID] = tab
	app.tabOrder = []string{tab.ID}
	app.activeTabID = tab.ID

	resolved, ok := app.reconcileTabWithPinnedSessionMeta(tab)
	if !ok || !sameDesktopPath(resolved, sessionPath) {
		t.Fatalf("reconcile binding = %q, %v, want %q, true", resolved, ok, sessionPath)
	}
	if tab.Scope != "project" || !sameProjectRoot(tab.WorkspaceRoot, projectRoot) {
		t.Fatalf("reconciled tab binding = %q/%q, want project/%q", tab.Scope, tab.WorkspaceRoot, projectRoot)
	}
}

func TestPinSessionBranchMetaReturnsCorruptSidecarError(t *testing.T) {
	isolateDesktopUserDirs(t)

	sessionPath := filepath.Join(t.TempDir(), "corrupt.jsonl")
	if err := os.WriteFile(sessionPath, nil, 0o644); err != nil {
		t.Fatalf("write session: %v", err)
	}
	metaPath := agent.BranchMetaPath(sessionPath)
	const corruptMeta = `{"scope":`
	if err := os.WriteFile(metaPath, []byte(corruptMeta), 0o644); err != nil {
		t.Fatalf("write corrupt branch meta: %v", err)
	}

	if err := pinSessionBranchMeta(sessionPath, "project", t.TempDir(), "topic", "Topic"); err == nil {
		t.Fatal("pinSessionBranchMeta error = nil, want corrupt sidecar error")
	}
	got, err := os.ReadFile(metaPath)
	if err != nil {
		t.Fatalf("read corrupt branch meta: %v", err)
	}
	if string(got) != corruptMeta {
		t.Fatalf("corrupt branch meta was overwritten: %q", got)
	}
}

func TestPinNewEmptySessionBranchMetaCleansUpRejectedBinding(t *testing.T) {
	isolateDesktopUserDirs(t)

	dir := t.TempDir()
	path, err := createEmptySessionFile(dir, "test-model")
	if err != nil {
		t.Fatalf("createEmptySessionFile: %v", err)
	}
	if err := pinNewEmptySessionBranchMeta(
		path,
		"project",
		"",
		"topic",
		"Topic",
	); err == nil {
		t.Fatal("pinNewEmptySessionBranchMeta error = nil, want missing project root error")
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read session dir: %v", err)
	}
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasSuffix(name, ".jsonl") || strings.HasSuffix(name, ".meta") {
			t.Fatalf("rejected binding left session artifact %q", name)
		}
	}
}

func TestPinSessionBranchMetaPreservesExistingFields(t *testing.T) {
	isolateDesktopUserDirs(t)

	sessionPath := filepath.Join(t.TempDir(), "existing.jsonl")
	if err := os.WriteFile(sessionPath, nil, 0o644); err != nil {
		t.Fatalf("write session: %v", err)
	}
	existing := agent.BranchMeta{
		CustomTitle:    "Keep title",
		Model:          "provider/model",
		Revision:       7,
		ContentDigest:  "digest",
		WriterID:       "writer",
		SchemaVersion:  agent.BranchMetaCountsVersion,
		Turns:          3,
		Preview:        "Keep preview",
		RecoveryReason: "keep recovery",
	}
	if err := agent.SaveBranchMetaPreserveUpdated(sessionPath, existing); err != nil {
		t.Fatalf("save existing branch meta: %v", err)
	}

	projectRoot := t.TempDir()
	if err := pinSessionBranchMeta(sessionPath, "project", projectRoot, "topic", "Topic"); err != nil {
		t.Fatalf("pinSessionBranchMeta: %v", err)
	}
	got, ok, err := agent.LoadBranchMeta(sessionPath)
	if err != nil || !ok {
		t.Fatalf("LoadBranchMeta: ok=%v err=%v", ok, err)
	}
	if got.CustomTitle != existing.CustomTitle ||
		got.Model != existing.Model ||
		got.Revision != existing.Revision ||
		got.ContentDigest != existing.ContentDigest ||
		got.WriterID != existing.WriterID ||
		got.SchemaVersion != existing.SchemaVersion ||
		got.Turns != existing.Turns ||
		got.Preview != existing.Preview ||
		got.RecoveryReason != existing.RecoveryReason {
		t.Fatalf("pinning dropped existing fields: got %+v, existing %+v", got, existing)
	}
}
