package agent

import (
	"fmt"
	"strings"
)

// SessionKind identifies the native Northwing session surface backed by a
// transcript. It is independent from transport/source classifications such as
// channel sessions.
type SessionKind string

const (
	SessionKindChat SessionKind = "chat"
	SessionKindWork SessionKind = "work"
)

// NormalizeSessionKind maps legacy missing identity to an ordinary chat. An
// unknown non-empty value is retained so validation can reject corrupt data.
func NormalizeSessionKind(kind SessionKind) SessionKind {
	if strings.TrimSpace(string(kind)) == "" {
		return SessionKindChat
	}
	return kind
}

// ValidateSessionIdentity enforces the persisted native identity contract.
func ValidateSessionIdentity(kind SessionKind, workID string) error {
	kind = NormalizeSessionKind(kind)
	workID = strings.TrimSpace(workID)
	switch kind {
	case SessionKindChat:
		if workID != "" {
			return fmt.Errorf("chat session cannot carry a Work ID")
		}
		return nil
	case SessionKindWork:
		if workID == "" {
			return fmt.Errorf("work session requires a Work ID")
		}
		return nil
	default:
		return fmt.Errorf("unknown session kind %q", kind)
	}
}

// SetSessionIdentity atomically updates the BranchMeta sidecar while preserving
// its revision ledger. A bound Work ID is immutable for that transcript.
func SetSessionIdentity(sessionPath string, kind SessionKind, workID string) error {
	if strings.TrimSpace(sessionPath) == "" {
		return fmt.Errorf("empty session path")
	}
	kind = NormalizeSessionKind(kind)
	workID = strings.TrimSpace(workID)
	if err := ValidateSessionIdentity(kind, workID); err != nil {
		return err
	}

	unlock := LockSessionMetaPath(sessionPath)
	defer unlock()
	meta, err := EnsureBranchMeta(sessionPath)
	if err != nil {
		return err
	}
	existingKind := NormalizeSessionKind(meta.SessionKind)
	existingWorkID := ""
	if meta.SessionKind != "" {
		existingWorkID = strings.TrimSpace(meta.WorkID)
	}
	if existingKind == SessionKindWork {
		if kind != SessionKindWork || existingWorkID != workID {
			return fmt.Errorf("session Work ID is already bound to %q", existingWorkID)
		}
	}
	if existingWorkID != "" && existingWorkID != workID {
		return fmt.Errorf("session Work ID is already bound to %q", existingWorkID)
	}
	meta.SessionKind = kind
	meta.WorkID = workID
	return SaveBranchMetaPreserveUpdated(sessionPath, meta)
}

// LoadSessionIdentity reads native identity from the canonical BranchMeta
// sidecar. Missing sidecars and legacy sidecars without session_kind are chat.
func LoadSessionIdentity(sessionPath string) (SessionKind, string, error) {
	meta, ok, err := LoadBranchMeta(sessionPath)
	if err != nil {
		return "", "", err
	}
	if !ok || meta.SessionKind == "" {
		return SessionKindChat, "", nil
	}
	kind := NormalizeSessionKind(meta.SessionKind)
	workID := strings.TrimSpace(meta.WorkID)
	if err := ValidateSessionIdentity(kind, workID); err != nil {
		return "", "", fmt.Errorf("invalid session identity for %s: %w", sessionPath, err)
	}
	return kind, workID, nil
}
