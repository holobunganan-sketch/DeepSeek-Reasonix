package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestApplyNorthwingCLIIdentityUsesIndependentHomes(t *testing.T) {
	home := filepath.Join(t.TempDir(), "home")
	state := filepath.Join(t.TempDir(), "state")
	cache := filepath.Join(t.TempDir(), "cache")
	for _, name := range []string{"REASONIX_HOME", "REASONIX_STATE_HOME", "REASONIX_CACHE_HOME"} {
		t.Setenv(name, "")
	}
	t.Setenv("NORTHWING_HOME", home)
	t.Setenv("NORTHWING_STATE_HOME", state)
	t.Setenv("NORTHWING_CACHE_HOME", cache)

	applyNorthwingCLIIdentity()
	for name, want := range map[string]string{
		"REASONIX_HOME":       home,
		"REASONIX_STATE_HOME": state,
		"REASONIX_CACHE_HOME": cache,
	} {
		if got := os.Getenv(name); got != want {
			t.Fatalf("%s = %q, want %q", name, got, want)
		}
	}
}

func TestApplyNorthwingCLIIdentityPreservesExplicitReasonixRuntime(t *testing.T) {
	for _, name := range []string{"REASONIX_HOME", "REASONIX_STATE_HOME", "REASONIX_CACHE_HOME"} {
		t.Setenv(name, "")
	}
	explicitState := filepath.Join(t.TempDir(), "reasonix-state")
	t.Setenv("REASONIX_STATE_HOME", explicitState)
	t.Setenv("NORTHWING_HOME", filepath.Join(t.TempDir(), "northwing"))

	applyNorthwingCLIIdentity()
	if got := os.Getenv("REASONIX_STATE_HOME"); got != explicitState {
		t.Fatalf("REASONIX_STATE_HOME = %q, want %q", got, explicitState)
	}
	if got := os.Getenv("REASONIX_HOME"); got != "" {
		t.Fatalf("REASONIX_HOME = %q, want explicit runtime untouched", got)
	}
	if got := os.Getenv("REASONIX_CACHE_HOME"); got != "" {
		t.Fatalf("REASONIX_CACHE_HOME = %q, want explicit runtime untouched", got)
	}
}
