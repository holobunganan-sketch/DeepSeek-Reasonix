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

func TestHarnessStepsForQuality(t *testing.T) {
	quick := HarnessStepsForQuality("quick")
	if len(quick) != 3 || quick[0] != HarnessStepInspect || quick[1] != HarnessStepProduce || quick[2] != HarnessStepValidate {
		t.Fatalf("quick steps = %v", quick)
	}
	standard := HarnessStepsForQuality("standard")
	if len(standard) != 6 || standard[0] != HarnessStepInventory || standard[5] != HarnessStepValidate {
		t.Fatalf("standard steps = %v", standard)
	}
	deep := HarnessStepsForQuality("deep")
	if len(deep) != 9 || deep[1] != HarnessStepEvidenceLedger || deep[5] != HarnessStepIndependentReview || deep[8] != HarnessStepRequirementAudit {
		t.Fatalf("deep steps = %v", deep)
	}
}

func TestWorkStageForHarnessStep(t *testing.T) {
	tests := []struct {
		step  HarnessStep
		stage WorkStage
	}{
		{HarnessStepInspect, WorkStageIntake},
		{HarnessStepInventory, WorkStageIntake},
		{HarnessStepEvidenceLedger, WorkStageIntake},
		{HarnessStepPlan, WorkStagePlanning},
		{HarnessStepProduce, WorkStageProducing},
		{HarnessStepReview, WorkStageReviewing},
		{HarnessStepIndependentReview, WorkStageReviewing},
		{HarnessStepRepair, WorkStageRepairing},
		{HarnessStepValidate, WorkStageValidating},
		{HarnessStepRequirementAudit, WorkStageValidating},
	}
	for _, tc := range tests {
		stage, err := WorkStageForHarnessStep(tc.step)
		if err != nil {
			t.Fatalf("WorkStageForHarnessStep(%s): %v", tc.step, err)
		}
		if stage != tc.stage {
			t.Fatalf("WorkStageForHarnessStep(%s) = %s, want %s", tc.step, stage, tc.stage)
		}
	}
	if _, err := WorkStageForHarnessStep("unknown"); !errors.Is(err, ErrUnsupportedHarnessStep) {
		t.Fatalf("unknown step error = %v, want ErrUnsupportedHarnessStep", err)
	}
}

func TestNormalizeWorkPolicyDefaultsHarnessStepsAndStage(t *testing.T) {
	work := WorkRef{Quality: "deep"}
	if err := NormalizeWorkPolicy(&work); err != nil {
		t.Fatalf("NormalizeWorkPolicy: %v", err)
	}
	if work.Stage != WorkStageIntake {
		t.Fatalf("Stage = %s, want intake", work.Stage)
	}
	if len(work.HarnessSteps) != 9 || work.HarnessSteps[0] != HarnessStepInventory {
		t.Fatalf("HarnessSteps = %v", work.HarnessSteps)
	}
}

func TestNormalizeWorkPolicyMigratesLegacyInventoryStage(t *testing.T) {
	work := WorkRef{Stage: "inventory", Quality: "standard"}
	if err := NormalizeWorkPolicy(&work); err != nil {
		t.Fatalf("NormalizeWorkPolicy: %v", err)
	}
	if work.Stage != WorkStageIntake {
		t.Fatalf("Stage = %s, want intake", work.Stage)
	}
}

func TestNormalizeWorkPolicyRejectsUnsupportedHarnessStep(t *testing.T) {
	work := WorkRef{HarnessSteps: []HarnessStep{"unknown_step"}}
	if err := NormalizeWorkPolicy(&work); !errors.Is(err, ErrUnsupportedHarnessStep) {
		t.Fatalf("error = %v, want ErrUnsupportedHarnessStep", err)
	}
}
