package cowork

import (
	"errors"
	"fmt"
	"strings"
	"unicode"
)

const CurrentHarnessVersion = 2

const (
	WorkStagePlanning    = "planning"
	WorkStageInventory   = "inventory"
	WorkStageProducing   = "producing"
	WorkStageReviewing   = "reviewing"
	WorkStageRepairing   = "repairing"
	WorkStageValidating  = "validating"
	WorkStageWaitingUser = "waiting_user"
	WorkStageCompleted   = "completed"
	WorkStageFailed      = "failed"
)

var (
	ErrUnsupportedWorkKind       = errors.New("unsupported cowork work kind")
	ErrUnsupportedWorkQuality    = errors.New("unsupported cowork work quality")
	ErrUnsupportedSourcePolicy   = errors.New("unsupported cowork source policy")
	ErrUnsupportedHarnessVersion = errors.New("unsupported cowork harness version")
	ErrInvalidModelBinding       = errors.New("invalid cowork model binding")
	ErrUnsupportedWorkStage      = errors.New("unsupported cowork work stage")
	ErrInvalidAcceptanceProgress = errors.New("invalid cowork acceptance progress")
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

var supportedWorkStages = map[string]struct{}{
	WorkStagePlanning: {}, WorkStageInventory: {}, WorkStageProducing: {},
	WorkStageReviewing: {}, WorkStageRepairing: {}, WorkStageValidating: {},
	WorkStageWaitingUser: {}, WorkStageCompleted: {}, WorkStageFailed: {},
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
	work.Stage = strings.ToLower(strings.TrimSpace(work.Stage))
	if work.Stage == "" {
		work.Stage = WorkStagePlanning
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
