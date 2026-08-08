package cowork

import (
	"errors"
	"fmt"
	"strings"
	"unicode"
)

const CurrentHarnessVersion = 3

// WorkStage is the user-visible lifecycle state.
type WorkStage string

// HarnessStep is the internal quality-policy step.
type HarnessStep string

const (
	WorkStageIntake      WorkStage = "intake"
	WorkStagePlanning    WorkStage = "planning"
	WorkStageProducing   WorkStage = "producing"
	WorkStageReviewing   WorkStage = "reviewing"
	WorkStageRepairing   WorkStage = "repairing"
	WorkStageValidating  WorkStage = "validating"
	WorkStageWaitingUser WorkStage = "waiting_user"
	WorkStageCompleted   WorkStage = "completed"
	WorkStageFailed      WorkStage = "failed"
)

const (
	HarnessStepInspect           HarnessStep = "inspect"
	HarnessStepInventory         HarnessStep = "inventory"
	HarnessStepEvidenceLedger    HarnessStep = "evidence_ledger"
	HarnessStepPlan              HarnessStep = "plan"
	HarnessStepProduce           HarnessStep = "produce"
	HarnessStepReview            HarnessStep = "review"
	HarnessStepIndependentReview HarnessStep = "independent_review"
	HarnessStepRepair            HarnessStep = "repair"
	HarnessStepValidate          HarnessStep = "validate"
	HarnessStepRequirementAudit  HarnessStep = "requirement_audit"
)

var (
	ErrUnsupportedWorkKind       = errors.New("unsupported cowork work kind")
	ErrUnsupportedWorkQuality    = errors.New("unsupported cowork work quality")
	ErrUnsupportedSourcePolicy   = errors.New("unsupported cowork source policy")
	ErrUnsupportedHarnessVersion = errors.New("unsupported cowork harness version")
	ErrInvalidModelBinding       = errors.New("invalid cowork model binding")
	ErrUnsupportedWorkStage      = errors.New("unsupported cowork work stage")
	ErrInvalidAcceptanceProgress = errors.New("invalid cowork acceptance progress")
	ErrUnsupportedHarnessStep    = errors.New("unsupported cowork harness step")
)

var supportedWorkKinds = map[string]struct{}{
	"general":      {},
	"research":     {},
	"report":       {},
	"presentation": {},
	"analysis":     {},
	"review":       {},
	"batch":        {},
}

var supportedWorkStages = map[WorkStage]struct{}{
	WorkStageIntake: {}, WorkStagePlanning: {}, WorkStageProducing: {},
	WorkStageReviewing: {}, WorkStageRepairing: {}, WorkStageValidating: {},
	WorkStageWaitingUser: {}, WorkStageCompleted: {}, WorkStageFailed: {},
}

var supportedHarnessSteps = map[HarnessStep]struct{}{
	HarnessStepInspect: {}, HarnessStepInventory: {}, HarnessStepEvidenceLedger: {},
	HarnessStepPlan: {}, HarnessStepProduce: {}, HarnessStepReview: {},
	HarnessStepIndependentReview: {}, HarnessStepRepair: {}, HarnessStepValidate: {},
	HarnessStepRequirementAudit: {},
}

var harnessStepsForQuality = map[string][]HarnessStep{
	"quick":    {HarnessStepInspect, HarnessStepProduce, HarnessStepValidate},
	"standard": {HarnessStepInventory, HarnessStepPlan, HarnessStepProduce, HarnessStepReview, HarnessStepRepair, HarnessStepValidate},
	"deep": {
		HarnessStepInventory, HarnessStepEvidenceLedger, HarnessStepPlan, HarnessStepProduce,
		HarnessStepReview, HarnessStepIndependentReview, HarnessStepRepair, HarnessStepValidate,
		HarnessStepRequirementAudit,
	},
}

var harnessStepToWorkStage = map[HarnessStep]WorkStage{
	HarnessStepInspect:           WorkStageIntake,
	HarnessStepInventory:         WorkStageIntake,
	HarnessStepEvidenceLedger:    WorkStageIntake,
	HarnessStepPlan:              WorkStagePlanning,
	HarnessStepProduce:           WorkStageProducing,
	HarnessStepReview:            WorkStageReviewing,
	HarnessStepIndependentReview: WorkStageReviewing,
	HarnessStepRepair:            WorkStageRepairing,
	HarnessStepValidate:          WorkStageValidating,
	HarnessStepRequirementAudit:  WorkStageValidating,
}

var supportedWorkQualities = map[string]struct{}{
	"quick":    {},
	"standard": {},
	"deep":     {},
}

var supportedSourcePolicies = map[string]struct{}{
	"project_only":     {},
	"project_plus_web": {},
	"verified_web":     {},
}

// NormalizeWorkPolicy applies backward-compatible defaults and validates the
// compact Work policy stored in project.json. Provider credentials and complete
// model configuration remain owned by Reasonix.
// WorkStageForHarnessStep maps an internal Harness step to the user-visible WorkStage.
func WorkStageForHarnessStep(step HarnessStep) (WorkStage, error) {
	stage, ok := harnessStepToWorkStage[step]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrUnsupportedHarnessStep, step)
	}
	return stage, nil
}

// HarnessStepsForQuality returns the ordered Harness steps for a given quality policy.
func HarnessStepsForQuality(quality string) []HarnessStep {
	steps, ok := harnessStepsForQuality[strings.ToLower(strings.TrimSpace(quality))]
	if !ok {
		return nil
	}
	out := make([]HarnessStep, len(steps))
	copy(out, steps)
	return out
}

// InitialWorkStageForQuality returns the user-visible stage for a freshly started Work.
func InitialWorkStageForQuality(quality string) WorkStage {
	steps := HarnessStepsForQuality(quality)
	if len(steps) == 0 {
		return WorkStageIntake
	}
	stage, _ := WorkStageForHarnessStep(steps[0])
	return stage
}

func NormalizeWorkPolicy(work *WorkRef) error {
	if work == nil {
		return errors.New("cowork work policy is required")
	}
	work.Kind = strings.ToLower(strings.TrimSpace(work.Kind))
	if work.Kind == "" {
		work.Kind = "general"
	}
	work.Quality = strings.ToLower(strings.TrimSpace(work.Quality))
	if work.Quality == "" {
		work.Quality = "standard"
	}
	work.SourcePolicy = strings.ToLower(strings.TrimSpace(work.SourcePolicy))
	if work.SourcePolicy == "" {
		work.SourcePolicy = "project_only"
	}
	work.ModelRef = strings.TrimSpace(work.ModelRef)
	work.ReasoningEffort = strings.TrimSpace(work.ReasoningEffort)
	if work.HarnessVersion == 0 {
		work.HarnessVersion = CurrentHarnessVersion
	}
	work.Stage = WorkStage(strings.ToLower(strings.TrimSpace(string(work.Stage))))
	// Migrate legacy Harness v2 stage "inventory" to v3 "intake".
	if work.Stage == "inventory" {
		work.Stage = WorkStageIntake
	}
	if work.Stage == "" {
		work.Stage = InitialWorkStageForQuality(work.Quality)
	}
	if len(work.HarnessSteps) == 0 {
		work.HarnessSteps = HarnessStepsForQuality(work.Quality)
	}
	return ValidateWorkPolicy(*work)
}

func ValidateWorkPolicy(work WorkRef) error {
	if _, ok := supportedWorkKinds[work.Kind]; !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedWorkKind, work.Kind)
	}
	if _, ok := supportedWorkQualities[work.Quality]; !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedWorkQuality, work.Quality)
	}
	if _, ok := supportedSourcePolicies[work.SourcePolicy]; !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedSourcePolicy, work.SourcePolicy)
	}
	if work.HarnessVersion != CurrentHarnessVersion {
		return fmt.Errorf("%w: got %d, want %d", ErrUnsupportedHarnessVersion, work.HarnessVersion, CurrentHarnessVersion)
	}
	if _, ok := supportedWorkStages[work.Stage]; !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedWorkStage, work.Stage)
	}
	for i, step := range work.HarnessSteps {
		normalized := HarnessStep(strings.ToLower(strings.TrimSpace(string(step))))
		work.HarnessSteps[i] = normalized
		if _, ok := supportedHarnessSteps[normalized]; !ok {
			return fmt.Errorf("%w: %s", ErrUnsupportedHarnessStep, normalized)
		}
	}
	if work.CompletedCriteria < 0 || work.TotalCriteria < 0 || work.CompletedCriteria > work.TotalCriteria {
		return fmt.Errorf("%w: completed=%d total=%d", ErrInvalidAcceptanceProgress, work.CompletedCriteria, work.TotalCriteria)
	}
	if err := validateBindingText("model", work.ModelRef, 256); err != nil {
		return err
	}
	if err := validateBindingText("reasoning effort", work.ReasoningEffort, 64); err != nil {
		return err
	}
	return nil
}

func validateBindingText(field, value string, max int) error {
	if len(value) > max {
		return fmt.Errorf("%w: %s exceeds %d bytes", ErrInvalidModelBinding, field, max)
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return fmt.Errorf("%w: %s contains control characters", ErrInvalidModelBinding, field)
		}
	}
	return nil
}
