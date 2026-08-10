//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWaitForProcessTimesOutWithoutTermination(t *testing.T) {
	err := waitForProcess(os.Getpid(), time.Millisecond)
	if err == nil {
		t.Fatal("waitForProcess returned nil for the still-running test process")
	}
	if !strings.Contains(err.Error(), "did not exit within") {
		t.Fatalf("waitForProcess error = %q, want graceful timeout", err)
	}
}

func TestValidateCleanupTargetRejectsUnrelatedDirectory(t *testing.T) {
	staging := t.TempDir()
	helperDir := t.TempDir()
	helper := filepath.Join(helperDir, "northwing-update-helper.exe")
	if err := os.WriteFile(helper, []byte("helper"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, _, err := validateCleanupTarget(staging, helper); err == nil || !strings.Contains(err.Error(), "does not directly own") {
		t.Fatalf("validateCleanupTarget error = %v, want ownership rejection", err)
	}
}

func TestCleanupStagingWaitsForOwnerThenRemovesPayload(t *testing.T) {
	staging := t.TempDir()
	helper := filepath.Join(staging, "northwing-update-helper.exe")
	installer := filepath.Join(staging, "Northwing-0.3.1-windows-x64-setup.exe")
	nested := filepath.Join(staging, "temporary", "payload.bin")
	if err := os.MkdirAll(filepath.Dir(nested), 0o700); err != nil {
		t.Fatal(err)
	}
	for path, content := range map[string]string{helper: "helper", installer: "installer", nested: "payload"} {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	waitedPID := 0
	if err := cleanupStagingAfterProcess(staging, helper, 1234, func(pid int, _ time.Duration) error {
		waitedPID = pid
		return nil
	}); err != nil {
		t.Fatalf("cleanupStagingAfterProcess: %v", err)
	}
	if waitedPID != 1234 {
		t.Fatalf("waited for pid %d, want 1234", waitedPID)
	}
	if _, err := os.Stat(staging); !os.IsNotExist(err) {
		t.Fatalf("staging directory still exists or stat failed: %v", err)
	}
}

func TestCleanupStagingWritesDiagnosticWhenWaitFails(t *testing.T) {
	staging := t.TempDir()
	helper := filepath.Join(staging, "northwing-update-helper.exe")
	if err := os.WriteFile(helper, []byte("helper"), 0o600); err != nil {
		t.Fatal(err)
	}
	err := cleanupStagingAfterProcess(staging, helper, 1234, func(int, time.Duration) error {
		return os.ErrDeadlineExceeded
	})
	if err == nil {
		t.Fatal("cleanupStagingAfterProcess returned nil after wait failure")
	}
	diagnostic, readErr := os.ReadFile(filepath.Join(staging, cleanupDiagnosticName))
	if readErr != nil {
		t.Fatalf("read cleanup diagnostic: %v", readErr)
	}
	if !strings.Contains(string(diagnostic), "wait for update helper") {
		t.Fatalf("cleanup diagnostic = %q", diagnostic)
	}
}
