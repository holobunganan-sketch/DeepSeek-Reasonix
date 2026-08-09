//go:build windows

package main

import (
	"os"
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
