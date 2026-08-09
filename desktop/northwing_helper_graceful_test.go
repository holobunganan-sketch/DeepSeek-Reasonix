//go:build windows

package main

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

// TestNorthwingInstallerForbidsForcefulTermination verifies that the NSIS
// installer script no longer uses taskkill /F in the silent update path.
func TestNorthwingInstallerForbidsForcefulTermination(t *testing.T) {
	data, err := os.ReadFile("../scripts/windows/northwing-installer.nsi")
	if err != nil {
		t.Fatalf("read northwing-installer.nsi: %v", err)
	}
	content := string(data)
	if strings.Contains(content, "taskkill /F") || strings.Contains(content, "taskkill  /F") {
		t.Fatal("northwing-installer.nsi must not use taskkill /F; the updater helper waits for the main process to exit normally")
	}
}

// TestNorthwingUpdateHelperGracefulExit verifies that the update helper
// waits for the parent process normally and aborts on timeout without
// force-killing. A helper built from this repo must never silently force-kill
// the Northwing application during a normal update.
func TestNorthwingUpdateHelperGracefulExit(t *testing.T) {
	helper, err := exec.LookPath("go")
	if err != nil {
		t.Skipf("go not available: %v", err)
	}

	// Build a minimal test helper to verify the PID-wait behavior.
	helperBin := t.TempDir() + `\northwing-update-helper-test.exe`
	build := exec.Command(helper, "build", "-o", helperBin, "./cmd/northwing-update-helper")
	build.Dir = ".."
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build helper: %v\n%s", err, out)
	}

	// A non-existent process returns immediately to the normal installer path;
	// that path must never force-stop Northwing.
	cmd := exec.Command(helperBin, "--installer", "nonexistent", "--pid", "9999999", "--restart", "nonexistent", "--expected-version", "0.0.0")
	cmd.Dir = t.TempDir()
	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("expected error for nonexistent PID, got success")
	}
	outStr := string(out)
	if !strings.Contains(outStr, "Northwing installer failed") {
		t.Fatalf("nonexistent PID output = %q, want normal installer-path failure", outStr)
	}
	if strings.Contains(strings.ToLower(outStr), "taskkill") || strings.Contains(strings.ToLower(outStr), "force") {
		t.Fatal("update helper must not invoke taskkill")
	}
}

// TestNorthwingHelperAbortsOnMissingRequiredFlags verifies the helper fails
// fast on missing required flags rather than proceeding with defaults.
func TestNorthwingHelperAbortsOnMissingRequiredFlags(t *testing.T) {
	helper, err := exec.LookPath("go")
	if err != nil {
		t.Skipf("go not available: %v", err)
	}

	helperBin := t.TempDir() + `\northwing-update-helper-test.exe`
	build := exec.Command(helper, "build", "-o", helperBin, "./cmd/northwing-update-helper")
	build.Dir = ".."
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build helper: %v\n%s", err, out)
	}

	tests := []struct {
		name string
		args []string
	}{
		{"no flags", []string{}},
		{"no pid", []string{"--installer", "x", "--restart", "x", "--expected-version", "0.0.0"}},
		{"no restart", []string{"--installer", "x", "--pid", "1", "--expected-version", "0.0.0"}},
		{"no expected version", []string{"--installer", "x", "--pid", "1", "--restart", "x"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := exec.Command(helperBin, tt.args...)
			err := cmd.Run()
			if err == nil {
				t.Fatal("expected error for missing flags")
			}
		})
	}
}
