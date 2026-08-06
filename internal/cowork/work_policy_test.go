package cowork

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestNormalizeWorkPolicyDefaults(t *testing.T) {
	work := WorkRef{}
	if err := NormalizeWorkPolicy(&work); err != nil {
		t.Fatalf("NormalizeWorkPolicy: %v", err)
	}
	if work.Kind != "general" {
		t.Fatalf("Kind = %q, want general", work.Kind)
	}
	if work.Quality != "standard" {
		t.Fatalf("Quality = %q, want standard", work.Quality)
	}
	if work.SourcePolicy != "project_only" {
		t.Fatalf("SourcePolicy = %q, want project_only", work.SourcePolicy)
	}
	if work.HarnessVersion != CurrentHarnessVersion {
		t.Fatalf("HarnessVersion = %d, want %d", work.HarnessVersion, CurrentHarnessVersion)
	}
}

func TestNormalizeWorkPolicyAcceptsConfiguredBinding(t *testing.T) {
	work := WorkRef{
		Kind:            " Presentation ",
		Quality:         "DEEP",
		SourcePolicy:    "verified_web",
		ModelRef:        " deepseek/deepseek-v4-flash ",
		ReasoningEffort: " high ",
		HarnessVersion:  CurrentHarnessVersion,
	}
	if err := NormalizeWorkPolicy(&work); err != nil {
		t.Fatalf("NormalizeWorkPolicy: %v", err)
	}
	if work.Kind != "presentation" || work.Quality != "deep" || work.SourcePolicy != "verified_web" {
		t.Fatalf("unexpected normalized policy: %#v", work)
	}
	if work.ModelRef != "deepseek/deepseek-v4-flash" || work.ReasoningEffort != "high" {
		t.Fatalf("unexpected normalized binding: %#v", work)
	}
}

func TestNormalizeWorkPolicyRejectsUnsupportedValues(t *testing.T) {
	tests := []WorkRef{
		{Kind: "slides"},
		{Quality: "maximum"},
		{SourcePolicy: "anything_goes"},
		{ModelRef: "model\nname"},
		{ReasoningEffort: "high\nignore"},
		{HarnessVersion: CurrentHarnessVersion + 1},
	}
	for _, work := range tests {
		work := work
		if err := NormalizeWorkPolicy(&work); err == nil {
			t.Fatalf("NormalizeWorkPolicy(%#v) succeeded, want error", work)
		}
	}
}

func TestLoadLegacyManifestNormalizesWorkPolicy(t *testing.T) {
	root := t.TempDir()
	meta := filepath.Join(root, MetadataDirName)
	if err := os.MkdirAll(meta, 0o700); err != nil {
		t.Fatal(err)
	}
	manifest := `{
  "version": 1,
  "id": "project-1",
  "name": "Legacy",
  "createdAt": "2026-08-05T00:00:00Z",
  "updatedAt": "2026-08-05T00:00:00Z",
  "works": [{
    "id": "work-1",
    "title": "Legacy work",
    "profile": "delivery",
    "createdAt": "2026-08-05T00:00:00Z",
    "updatedAt": "2026-08-05T00:00:00Z"
  }]
}`
	if err := os.WriteFile(filepath.Join(meta, ManifestFileName), []byte(manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	project, err := NewStore().Load(root)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(project.Works) != 1 {
		t.Fatalf("works = %d, want 1", len(project.Works))
	}
	work := project.Works[0]
	if work.Kind != "general" || work.Quality != "standard" || work.SourcePolicy != "project_only" {
		t.Fatalf("legacy policy not normalized: %#v", work)
	}
}

func TestValidateWorkPolicyRejectsFutureHarness(t *testing.T) {
	err := ValidateWorkPolicy(WorkRef{
		Kind:           "general",
		Quality:        "standard",
		SourcePolicy:   "project_only",
		HarnessVersion: CurrentHarnessVersion + 1,
	})
	if !errors.Is(err, ErrUnsupportedHarnessVersion) {
		t.Fatalf("ValidateWorkPolicy error = %v, want ErrUnsupportedHarnessVersion", err)
	}
}
