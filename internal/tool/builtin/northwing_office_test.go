package builtin

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestNorthwingOfficeDefaultExposureRequiresProjectManifest(t *testing.T) {
	dir := t.TempDir()
	ordinary := Workspace{Dir: dir}.Tools()
	for _, item := range ordinary {
		if item.Name() == "northwing_office" {
			t.Fatal("ordinary Reasonix workspace exposed the Northwing Office schema")
		}
	}
	if err := os.MkdirAll(filepath.Join(dir, ".northwing"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".northwing", "project.json"), []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, item := range (Workspace{Dir: dir}).Tools() {
		if item.Name() == "northwing_office" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("Northwing project did not expose the Office schema")
	}
}

func TestNorthwingOfficeWorkspaceBinding(t *testing.T) {
	dir := t.TempDir()
	tools := (Workspace{Dir: dir}).Tools("northwing_office")
	if len(tools) != 1 || tools[0].Name() != "northwing_office" {
		t.Fatalf("tools = %#v", tools)
	}
	args, _ := json.Marshal(map[string]any{
		"action": "create_docx",
		"path":   "deliverables/work/report.docx",
		"title":  "Report",
		"text":   "Body",
	})
	out, err := tools[0].Execute(context.Background(), args)
	if err != nil {
		t.Fatal(err)
	}
	if out == "" {
		t.Fatal("empty Office report")
	}
	if _, err := os.Stat(filepath.Join(dir, "deliverables", "work", "report.docx")); err != nil {
		t.Fatal(err)
	}
}

func TestNorthwingOfficeRejectsOutsideWorkspace(t *testing.T) {
	dir := t.TempDir()
	outside := filepath.Join(t.TempDir(), "report.docx")
	tool := (Workspace{Dir: dir}).Tools("northwing_office")[0]
	args, _ := json.Marshal(map[string]any{
		"action": "create_docx",
		"path":   outside,
		"text":   "Body",
	})
	if _, err := tool.Execute(context.Background(), args); err == nil {
		t.Fatal("outside-workspace Office write succeeded")
	}
}

func TestNorthwingOfficeRejectsOutsideWorkspaceRead(t *testing.T) {
	dir := t.TempDir()
	outsideDir := t.TempDir()
	outside := filepath.Join(outsideDir, "report.docx")
	createArgs, _ := json.Marshal(map[string]any{
		"action": "create_docx",
		"path":   "report.docx",
		"text":   "Body",
	})
	if _, err := (Workspace{Dir: outsideDir}).Tools("northwing_office")[0].Execute(context.Background(), createArgs); err != nil {
		t.Fatal(err)
	}

	inspectArgs, _ := json.Marshal(map[string]any{
		"action": "inspect",
		"path":   outside,
	})
	if _, err := (Workspace{Dir: dir}).Tools("northwing_office")[0].Execute(context.Background(), inspectArgs); err == nil {
		t.Fatal("outside-workspace Office read succeeded")
	}
}
