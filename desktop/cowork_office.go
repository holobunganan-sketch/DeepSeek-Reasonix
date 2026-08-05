package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"reasonix/internal/office"
)

// InspectCoworkArtifact returns deterministic document structure for the
// Artifact Center. It accepts only files inside the selected project and never
// sends file contents to a model.
func (a *App) InspectCoworkArtifact(workspaceRoot, artifactPath string) (office.Report, error) {
	root, err := filepath.Abs(strings.TrimSpace(workspaceRoot))
	if err != nil {
		return office.Report{}, fmt.Errorf("resolve workspace: %w", err)
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return office.Report{}, fmt.Errorf("resolve workspace symlinks: %w", err)
	}
	path := strings.TrimSpace(artifactPath)
	if path == "" {
		return office.Report{}, fmt.Errorf("artifact path is required")
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(root, filepath.FromSlash(path))
	}
	path, err = filepath.Abs(path)
	if err != nil {
		return office.Report{}, fmt.Errorf("resolve artifact: %w", err)
	}
	path, err = filepath.EvalSymlinks(path)
	if err != nil {
		return office.Report{}, fmt.Errorf("resolve artifact: %w", err)
	}
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) || filepath.IsAbs(rel) {
		return office.Report{}, fmt.Errorf("artifact is outside the selected project")
	}
	return office.Inspect(path)
}
