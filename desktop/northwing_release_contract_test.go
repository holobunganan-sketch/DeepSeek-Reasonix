package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
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
		"Validate stable tag, product version, and ancestry",
		"Prepare and validate release credential",
		"Test root Go",
		"Install frontend",
		"Typecheck frontend",
		"Test frontend",
		"Build frontend",
		"Install Playwright Chromium",
		"Run Northwing browser E2E",
		"Test desktop Go",
		"Build Northwing Windows x64",
		"Build Northwing update helper",
		"Sign and verify payload binaries",
		"Package signed Northwing artifacts",
		"Sign and verify setup",
		"Generate final checksums",
		"Sign and verify Northwing update manifest",
		"Independently verify signed manifest",
		"Verify formal manifest with Northwing runtime",
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
	for _, command := range []string{
		"go test ./...",
		"pnpm typecheck",
		"pnpm test",
		"pnpm build",
		"pnpm exec playwright install chromium",
		"pnpm test:e2e",
		"go build -trimpath -ldflags \"-s -w\" -o desktop/build/bin/northwing-update-helper.exe ./cmd/northwing-update-helper",
		"verify-northwing-release-signatures.ps1",
		"NORTHWING_RELEASE_ARTIFACT_DIR",
		"NORTHWING_MANIFEST_SPKI_BASE64",
		"TestNorthwingReleaseManifestFormalArtifacts",
		"verify-northwing-windows.ps1 -Version '${{ steps.version.outputs.version }}' -Repository '${{ github.repository }}'",
	} {
		if !strings.Contains(source, command) {
			t.Fatalf("release quality gate missing command %q", command)
		}
	}
	cleanup := strings.Index(source, "Remove release credential material")
	if cleanup < 0 || !strings.Contains(source[cleanup:], "if: always()") {
		t.Fatal("release credential cleanup must run with if: always()")
	}
}

func TestNorthwingCIKeepsUnsignedArtifactsIsolatedAndBuildsHelper(t *testing.T) {
	workflow, err := os.ReadFile("../.github/workflows/northwing-ci.yml")
	if err != nil {
		t.Fatal(err)
	}
	source := string(workflow)
	helperBuild := strings.Index(source, "Build Northwing update helper")
	packageStep := strings.Index(source, "Package installer and portable build")
	if helperBuild < 0 || packageStep < 0 || helperBuild >= packageStep {
		t.Fatal("Northwing CI must build the update helper before packaging")
	}
	for _, want := range []string{
		"go build -trimpath -ldflags \"-s -w\" -o desktop/build/bin/northwing-update-helper.exe ./cmd/northwing-update-helper",
		"-UnsignedTestArtifact",
		"-AllowUnsignedTestArtifact",
		"UNSIGNED-TEST-ONLY-Northwing-",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("Northwing CI unsigned boundary missing %q", want)
		}
	}
	if strings.Contains(source, "softprops/action-gh-release") {
		t.Fatal("Northwing CI must not contain a GitHub Release publish action")
	}
}

func TestNorthwingReleasePackagingAndVerificationCoverFinalSignedArtifacts(t *testing.T) {
	packageScript, err := os.ReadFile("../scripts/package-northwing-windows.ps1")
	if err != nil {
		t.Fatal(err)
	}
	verifyScript, err := os.ReadFile("../scripts/verify-northwing-windows.ps1")
	if err != nil {
		t.Fatal(err)
	}
	packaging := string(packageScript)
	verification := string(verifyScript)
	for _, want := range []string{
		"SignerCertificate",
		"TimeStamperCertificate",
		"verify /pa /all",
		"UnsignedTestArtifact",
		"FinalizeChecksums",
		"ValidatePayloadOnly",
	} {
		if !strings.Contains(packaging, want) {
			t.Fatalf("formal packaging contract missing %q", want)
		}
	}
	if strings.Contains(packaging, "go build") {
		t.Fatal("packaging must not rebuild the update helper in any mode")
	}
	for _, want := range []string{
		"Northwing-$Version-windows-x64-setup.exe",
		"Northwing-$Version-windows-x64-portable.zip",
		"Northwing-$Version-SHA256SUMS.txt",
		"northwing-update.json",
		"northwing-update.json.sig",
		"northwing.exe",
		"northwing-update-helper.exe",
		"SignerCertificate",
		"TimeStamperCertificate",
		"verify /pa /all",
		"verify-northwing-release-signatures.ps1",
	} {
		if !strings.Contains(verification, want) {
			t.Fatalf("formal verification contract missing %q", want)
		}
	}
}

func runNorthwingPackagingScript(t *testing.T, args ...string) ([]byte, error) {
	t.Helper()
	if runtime.GOOS != "windows" {
		t.Skip("Northwing packaging behavior requires Windows Authenticode")
	}
	pwsh, err := exec.LookPath("pwsh")
	if err != nil {
		t.Skip("pwsh is unavailable")
	}
	commandArgs := append([]string{"-NoProfile", "-File", "../scripts/package-northwing-windows.ps1"}, args...)
	return exec.Command(pwsh, commandArgs...).CombinedOutput()
}

func TestNorthwingReleasePackagingRejectsUnsignedPayloadByDefault(t *testing.T) {
	payloadDir := t.TempDir()
	for _, name := range []string{"northwing.exe", "northwing-update-helper.exe"} {
		if err := os.WriteFile(filepath.Join(payloadDir, name), []byte("unsigned test fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	output, err := runNorthwingPackagingScript(t,
		"-Version", "0.3.0", "-OutputDir", t.TempDir(), "-PayloadDir", payloadDir, "-ValidatePayloadOnly")
	if err == nil {
		t.Fatalf("formal packaging unexpectedly accepted unsigned payloads: %s", output)
	}
	if !strings.Contains(string(output), "valid Authenticode signature") {
		t.Fatalf("formal packaging failed for the wrong reason: %v\n%s", err, output)
	}
}

func TestNorthwingReleasePackagingAllowsExplicitUnsignedTestPayload(t *testing.T) {
	payloadDir := t.TempDir()
	for _, name := range []string{"northwing.exe", "northwing-update-helper.exe"} {
		if err := os.WriteFile(filepath.Join(payloadDir, name), []byte("unsigned test fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if output, err := runNorthwingPackagingScript(t,
		"-Version", "0.3.0", "-OutputDir", t.TempDir(), "-PayloadDir", payloadDir, "-ValidatePayloadOnly", "-UnsignedTestArtifact"); err != nil {
		t.Fatalf("explicit unsigned test packaging preflight failed: %v\n%s", err, output)
	}
}

func TestNorthwingReleaseFinalizeChecksumsUsesExistingFinalFilesOnly(t *testing.T) {
	outputDir := t.TempDir()
	for _, name := range []string{
		"Northwing-0.3.0-windows-x64-portable.zip",
		"Northwing-0.3.0-windows-x64-setup.exe",
	} {
		if err := os.WriteFile(filepath.Join(outputDir, name), []byte("final bytes for "+name), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if output, err := runNorthwingPackagingScript(t,
		"-Version", "0.3.0", "-OutputDir", outputDir, "-PayloadDir", filepath.Join(outputDir, "missing-payload"), "-FinalizeChecksums"); err != nil {
		t.Fatalf("final checksum pass touched missing build inputs: %v\n%s", err, output)
	}
	content, err := os.ReadFile(filepath.Join(outputDir, "Northwing-0.3.0-SHA256SUMS.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(strings.TrimSpace(string(content)), "\n") != 1 {
		t.Fatalf("checksum file must contain exactly two final artifact entries: %s", content)
	}
}
