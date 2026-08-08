package main

import (
	"os"
	"strings"
	"testing"
)

func TestNorthwingReleaseWorkflowFailsClosedWithOneCredentialAndOrderedGates(t *testing.T) {
	workflow, err := os.ReadFile("../.github/workflows/northwing-release.yml")
	if err != nil {
		t.Fatal(err)
	}
	source := string(workflow)
	for _, want := range []string{
		"environment: northwing-release",
		"secrets.NORTHWING_WINDOWS_RELEASE_CREDENTIAL",
		"origin/main-v2",
		"github.repository",
		"main.northwingManifestPublicKeySPKIBase64",
		"northwing-update.json.sig",
		"UNSIGNED-TEST-ONLY",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("release contract missing %q", want)
		}
	}
	for _, forbidden := range []string{"SIGNPATH_API_TOKEN", "AZURE_TRUSTED_SIGNING", "NORTHWING_SIGNING_CERTIFICATE"} {
		if strings.Contains(source, forbidden) {
			t.Fatalf("release workflow retains second credential contract %q", forbidden)
		}
	}
	steps := []string{
		"Prepare and validate release credential",
		"Build Northwing Windows x64",
		"Sign and verify payload binaries",
		"Package signed Northwing artifacts",
		"Sign and verify setup",
		"Generate final checksums",
		"Sign and verify Northwing update manifest",
		"Verify signed Windows release",
		"Publish GitHub Release",
	}
	last := -1
	for _, step := range steps {
		at := strings.Index(source, step)
		if at < 0 || at <= last {
			t.Fatalf("release gate %q is absent or out of order", step)
		}
		last = at
	}
}
