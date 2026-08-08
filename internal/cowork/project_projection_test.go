package cowork

import (
	"testing"
)

func TestUpdateWorkProjection(t *testing.T) {
	dir := t.TempDir()
	store := NewStore()
	if _, err := store.Create(dir, "test"); err != nil {
		t.Fatalf("create project: %v", err)
	}
	work := WorkRef{
		ID:                 "work-1",
		Title:              "Test Work",
		Profile:            "delivery",
		Quality:            "standard",
		SourcePolicy:       "project_only",
		HarnessVersion:     CurrentHarnessVersion,
		Stage:              WorkStageIntake,
		HarnessSteps:       HarnessStepsForQuality("standard"),
		CurrentHarnessStep: HarnessStepInventory,
		Acceptance:         []AcceptanceItem{{ID: "acc-1", Text: "Opens", Status: "pending"}},
		CompletedCriteria:  0,
		TotalCriteria:      1,
	}
	if _, err := store.LinkWork(dir, work); err != nil {
		t.Fatalf("link work: %v", err)
	}

	update := WorkProjectionUpdate{
		Stage:              WorkStagePlanning,
		CurrentHarnessStep: HarnessStepPlan,
		Acceptance:         []AcceptanceItem{{ID: "acc-1", Text: "Opens", Status: "met", Evidence: "checked"}},
		UnresolvedFindings: []string{"typo in heading"},
		CompletedCriteria:  1,
		TotalCriteria:      1,
	}
	project, err := store.UpdateWorkProjection(dir, "work-1", update)
	if err != nil {
		t.Fatalf("update projection: %v", err)
	}
	if len(project.Works) != 1 {
		t.Fatalf("expected 1 work, got %d", len(project.Works))
	}
	updated := project.Works[0]
	if updated.Stage != WorkStagePlanning {
		t.Errorf("stage: got %q, want %q", updated.Stage, WorkStagePlanning)
	}
	if updated.CurrentHarnessStep != HarnessStepPlan {
		t.Errorf("current harness step: got %q, want %q", updated.CurrentHarnessStep, HarnessStepPlan)
	}
	if len(updated.Acceptance) != 1 || updated.Acceptance[0].Status != "met" {
		t.Errorf("acceptance: got %+v", updated.Acceptance)
	}
	if len(updated.UnresolvedFindings) != 1 || updated.UnresolvedFindings[0] != "typo in heading" {
		t.Errorf("findings: got %+v", updated.UnresolvedFindings)
	}
	if updated.CompletedCriteria != 1 || updated.TotalCriteria != 1 {
		t.Errorf("criteria: got %d/%d", updated.CompletedCriteria, updated.TotalCriteria)
	}

	_, err = store.UpdateWorkProjection(dir, "work-1", update)
	if err != nil {
		t.Fatalf("idempotent update: %v", err)
	}
}
