package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reasonix/internal/agent"
	"reasonix/internal/cowork"
)

// NativeWorkMigrator binds Northwing 0.2 WorkRefs to native session identity.
// It is idempotent: repeated runs change nothing once a Work is safely bound.
type NativeWorkMigrator struct {
	store *cowork.Store
}

// NewNativeWorkMigrator creates a migrator using the shared CoWork store.
func NewNativeWorkMigrator(store *cowork.Store) *NativeWorkMigrator {
	if store == nil {
		store = cowork.NewStore()
	}
	return &NativeWorkMigrator{store: store}
}

// EnsureProjectBindings scans a project's WorkRefs and writes native session
// identity (sessionKind=work, workId=<work-id>) to the matching session sidecar.
// Works whose session cannot be unambiguously identified are left with
// bindingStatus=needs_rebind and no sidecar is modified.
func (m *NativeWorkMigrator) EnsureProjectBindings(workspaceRoot string) (cowork.Project, error) {
	project, err := m.store.Load(workspaceRoot)
	if err != nil {
		return project, err
	}

	changed := false
	for i := range project.Works {
		work := &project.Works[i]
		if work.BindingStatus == cowork.BindingStatusNative {
			continue
		}
		sessionPath, ok := m.resolveSessionPath(workspaceRoot, *work)
		if !ok {
			work.BindingStatus = cowork.BindingStatusNeedsRebind
			continue
		}
		_, identityWorkID, err := agent.LoadSessionIdentity(sessionPath)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			work.BindingStatus = cowork.BindingStatusNeedsRebind
			continue
		}
		if identityWorkID != "" && identityWorkID != work.ID {
			// Conflicting native identity: refuse to overwrite.
			work.BindingStatus = cowork.BindingStatusNeedsRebind
			continue
		}
		if err := agent.SetSessionIdentity(sessionPath, agent.SessionKindWork, work.ID); err != nil {
			work.BindingStatus = cowork.BindingStatusNeedsRebind
			continue
		}
		work.BindingStatus = cowork.BindingStatusNative
		changed = true
	}

	if !changed {
		return project, nil
	}
	// Refresh and persist binding updates. LinkWork merges by ID.
	for _, work := range project.Works {
		if _, err := m.store.LinkWork(workspaceRoot, work); err != nil {
			return project, fmt.Errorf("persist migrated WorkRef %s: %w", work.ID, err)
		}
	}
	return m.store.Load(workspaceRoot)
}

// resolveSessionPath returns an absolute session path and true when the WorkRef
// can be safely mapped to exactly one session file.
func (m *NativeWorkMigrator) resolveSessionPath(workspaceRoot string, work cowork.WorkRef) (string, bool) {
	candidates := make(map[string]struct{})
	if work.SessionPath != "" {
		abs := filepath.Join(workspaceRoot, filepath.FromSlash(work.SessionPath))
		candidates[abs] = struct{}{}
	}
	if work.GoalID != "" {
		// Try the conventional session layout: <workspace>/sessions/<goalId>.jsonl
		conventional := filepath.Join(workspaceRoot, "sessions", work.GoalID+".jsonl")
		candidates[conventional] = struct{}{}
		// Some legacy layouts use the singular "session" directory.
		singular := filepath.Join(workspaceRoot, "session", work.GoalID+".jsonl")
		candidates[singular] = struct{}{}
	}
	// Deduplicate while preserving resolved paths.
	var paths []string
	for p := range candidates {
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			paths = append(paths, p)
		}
	}
	if len(paths) != 1 {
		return "", false
	}
	return paths[0], true
}

// NormalizeWorkBindings is a convenience entry used by project state bindings.
func (a *App) NormalizeWorkBindings(workspaceRoot string) (cowork.Project, error) {
	return NewNativeWorkMigrator(desktopCoworkStore).EnsureProjectBindings(workspaceRoot)
}
