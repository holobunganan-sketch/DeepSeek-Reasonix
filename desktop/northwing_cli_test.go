package main

import "testing"

func TestNorthwingCLIRequested(t *testing.T) {
	cliCases := [][]string{
		{"run", "write a report"},
		{"chat"},
		{"--version"},
		{"doctor"},
		{"--provider", "opencode-go"},
	}
	for _, args := range cliCases {
		if !northwingCLIRequested(args) {
			t.Fatalf("CLI args routed to desktop: %v", args)
		}
	}

	desktopCases := [][]string{
		nil,
		{"northwing://work?workspace=C%3A%5CProject"},
		{"--safe-mode"},
		{"launch"},
		{"-psn_0_12345"},
	}
	for _, args := range desktopCases {
		if northwingCLIRequested(args) {
			t.Fatalf("desktop args routed to CLI: %v", args)
		}
	}
}

func TestMaybeRunNorthwingCLIUsesKernelCLI(t *testing.T) {
	old := runNorthwingCLI
	defer func() { runNorthwingCLI = old }()
	var gotArgs []string
	var gotVersion string
	runNorthwingCLI = func(args []string, buildVersion string) int {
		gotArgs = append([]string(nil), args...)
		gotVersion = buildVersion
		return 17
	}
	handled, code := maybeRunNorthwingCLI([]string{"doctor", "--json"})
	if !handled || code != 17 {
		t.Fatalf("handled=%v code=%d", handled, code)
	}
	if len(gotArgs) != 2 || gotArgs[0] != "doctor" || gotVersion != version {
		t.Fatalf("args=%v version=%q", gotArgs, gotVersion)
	}
}

func TestMaybeRunNorthwingCLIDoesNotConsumeProtocol(t *testing.T) {
	handled, code := maybeRunNorthwingCLI([]string{"northwing://work"})
	if handled || code != 0 {
		t.Fatalf("protocol handled=%v code=%d", handled, code)
	}
}
