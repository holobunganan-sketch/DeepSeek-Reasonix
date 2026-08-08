package agent

import (
	"os"
	"path/filepath"
	"testing"

	"reasonix/internal/provider"
)

func TestSessionIdentityRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := SetSessionIdentity(path, SessionKindWork, "work-123"); err != nil {
		t.Fatal(err)
	}
	kind, workID, err := LoadSessionIdentity(path)
	if err != nil {
		t.Fatal(err)
	}
	if kind != SessionKindWork || workID != "work-123" {
		t.Fatalf("identity = %q/%q", kind, workID)
	}
}

func TestLegacySessionNormalizesToChat(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.jsonl")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	kind, workID, err := LoadSessionIdentity(path)
	if err != nil {
		t.Fatal(err)
	}
	if kind != SessionKindChat || workID != "" {
		t.Fatalf("identity = %q/%q", kind, workID)
	}
}

func TestSessionIdentityValidationAndStableWorkID(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := SetSessionIdentity(path, SessionKindWork, ""); err == nil {
		t.Fatal("empty Work ID was accepted")
	}
	if err := SetSessionIdentity(path, SessionKindChat, "work-123"); err == nil {
		t.Fatal("chat identity with Work ID was accepted")
	}
	if err := SetSessionIdentity(path, SessionKindWork, "work-123"); err != nil {
		t.Fatal(err)
	}
	if err := SetSessionIdentity(path, SessionKindWork, "work-456"); err == nil {
		t.Fatal("existing Work ID changed silently")
	}
	if err := SetSessionIdentity(path, SessionKindChat, ""); err == nil {
		t.Fatal("existing Work identity was silently reset")
	}
}

func TestSessionIdentityPreservesRevisionFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := SaveBranchMetaPreserveUpdated(path, BranchMeta{
		Revision:      7,
		ContentDigest: "digest",
		WriterID:      "writer",
	}); err != nil {
		t.Fatal(err)
	}
	if err := SetSessionIdentity(path, SessionKindWork, "work-123"); err != nil {
		t.Fatal(err)
	}
	meta, ok, err := LoadBranchMeta(path)
	if err != nil || !ok {
		t.Fatalf("LoadBranchMeta: ok=%v err=%v", ok, err)
	}
	if meta.Revision != 7 || meta.ContentDigest != "digest" || meta.WriterID != "writer" {
		t.Fatalf("revision fields changed: %+v", meta)
	}
}

func TestRecoveryBranchPreservesIdentity(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "session.jsonl")
	session := NewSession("")
	session.Add(provider.Message{Role: provider.RoleUser, Content: "first"})
	if err := session.Save(path); err != nil {
		t.Fatal(err)
	}
	if err := SetSessionIdentity(path, SessionKindWork, "work-123"); err != nil {
		t.Fatal(err)
	}
	session.Add(provider.Message{Role: provider.RoleUser, Content: "second"})
	info, err := session.SaveRecoveryBranch(RecoveryBranchOptions{OriginalPath: path})
	if err != nil {
		t.Fatal(err)
	}
	kind, workID, err := LoadSessionIdentity(info.Path)
	if err != nil {
		t.Fatal(err)
	}
	if kind != SessionKindWork || workID != "work-123" {
		t.Fatalf("recovery identity = %q/%q", kind, workID)
	}
}

func TestSessionIdentityForkMetadataInheritsParent(t *testing.T) {
	dir := t.TempDir()
	parentPath := filepath.Join(dir, "parent.jsonl")
	childPath := filepath.Join(dir, "child.jsonl")
	for _, path := range []string{parentPath, childPath} {
		if err := os.WriteFile(path, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		// Session.Save creates ordinary listing metadata before the controller
		// later records the fork relationship.
		if err := SaveBranchMeta(path, BranchMeta{}); err != nil {
			t.Fatal(err)
		}
	}
	if err := SetSessionIdentity(parentPath, SessionKindWork, "work-123"); err != nil {
		t.Fatal(err)
	}
	if err := SaveBranchMeta(childPath, BranchMeta{ParentID: BranchID(parentPath)}); err != nil {
		t.Fatal(err)
	}
	kind, workID, err := LoadSessionIdentity(childPath)
	if err != nil {
		t.Fatal(err)
	}
	if kind != SessionKindWork || workID != "work-123" {
		t.Fatalf("fork identity = %q/%q", kind, workID)
	}
}

func TestSessionIdentityWriteFailsClosedOnUnreadableSidecar(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	const corruptMeta = `{"session_kind":"work","work_id":"work-123"`
	if err := os.WriteFile(BranchMetaPath(path), []byte(corruptMeta), 0o600); err != nil {
		t.Fatal(err)
	}

	err := SaveBranchMetaPreserveUpdated(path, BranchMeta{
		SessionKind: SessionKindChat,
		CustomTitle: "must not land",
	})
	if err == nil {
		t.Fatal("SaveBranchMetaPreserveUpdated error = nil, want unreadable sidecar error")
	}
	got, readErr := os.ReadFile(BranchMetaPath(path))
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(got) != corruptMeta {
		t.Fatalf("unreadable sidecar was overwritten: %q", got)
	}
}
