package main

import (
	"os"
	"strings"
	"testing"
)

func TestNorthwingInstallerPreventsIgnoringLockedExecutable(t *testing.T) {
	data, err := os.ReadFile("../scripts/windows/northwing-installer.nsi")
	if err != nil {
		t.Fatal(err)
	}
	source := string(data)
	for _, want := range []string{
		"SetOverwrite try",
		"MB_RETRYCANCEL",
		"northwing.exe is still running",
		"northwing-update-helper.exe",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("installer missing %q", want)
		}
	}
	if strings.Contains(source, "[Ignore]") {
		t.Fatal("installer documents an Ignore path for the main executable")
	}
	if strings.Contains(strings.ToLower(source), "taskkill") {
		t.Fatal("Northwing installer or uninstaller retains a taskkill path")
	}
}
