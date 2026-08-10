package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func TestNorthwingReleaseWorkflowPublishesExplicitUnsignedArtifacts(t *testing.T) {
	workflow, err := os.ReadFile("../.github/workflows/northwing-release.yml")
	if err != nil {
		t.Fatal(err)
	}
	source := string(workflow)
	for _, want := range []string{
		"origin/main-v2",
		"NORTHWING_RELEASE_TAG: ${{ github.ref_name }}",
		"$tag = $env:NORTHWING_RELEASE_TAG",
		"persist-credentials: false",
		"resolve-northwing-release-version.ps1",
		"assert-northwing-release-checkout-clean.ps1",
		"Build and publish unsigned Northwing release",
		"-UnsignedTestArtifact",
		"-AllowUnsignedTestArtifact",
		"Northwing-${{ steps.version.outputs.version }}-windows-x64-setup.exe",
		"Northwing-${{ steps.version.outputs.version }}-windows-x64-portable.zip",
		"Northwing-${{ steps.version.outputs.version }}-SHA256SUMS.txt",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("release contract missing %q", want)
		}
	}
	if strings.Contains(source, "$tag = '${{ github.ref_name }}'") {
		t.Fatal("release workflow interpolates attacker-controlled tag data into PowerShell source")
	}
	if strings.Count(source, "contents: write") != 1 {
		t.Fatal("only the release job may have contents: write")
	}
	if regexp.MustCompile(`uses:\s+[^\s]+@v[0-9]`).MatchString(source) {
		t.Fatal("release workflow actions must be pinned to full commit SHAs")
	}
	for _, pinned := range []string{
		"actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
		"actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff",
		"pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
		"actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
		"softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65",
	} {
		if !strings.Contains(source, pinned) {
			t.Fatalf("release workflow missing pinned action %q", pinned)
		}
	}
	for _, forbidden := range []string{
		"NORTHWING_WINDOWS_RELEASE_CREDENTIAL",
		"SIGNPATH_API_TOKEN",
		"AZURE_TRUSTED_SIGNING",
		"NORTHWING_SIGNING_CERTIFICATE",
		"northwing-update.json",
		"northwingManifestPublicKeySPKIBase64",
	} {
		if strings.Contains(source, forbidden) {
			t.Fatalf("unsigned release workflow must not publish or consume %q", forbidden)
		}
	}
	steps := []string{
		"Validate stable tag, product version, and ancestry",
		"Install frontend",
		"Install Wails and NSIS",
		"Verify clean build checkout",
		"Build Northwing Windows x64",
		"Verify build output did not modify source checkout",
		"Build Northwing update helper",
		"Package unsigned installer and portable build",
		"Verify unsigned Windows installer and portable build",
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
		"wails build -platform windows/amd64 -clean",
		"go build -trimpath -ldflags \"-s -w\" -o desktop/build/bin/northwing-update-helper.exe ./cmd/northwing-update-helper",
		"package-northwing-windows.ps1",
		"verify-northwing-windows.ps1",
		"body_path: docs/NORTHWING_RELEASE_NOTES.md",
		"fail_on_unmatched_files: true",
	} {
		if !strings.Contains(source, command) {
			t.Fatalf("unsigned release gate missing command %q", command)
		}
	}
	if strings.Count(source, "assert-northwing-release-checkout-clean.ps1") != 2 {
		t.Fatal("release build must check its checkout before and after Wails")
	}
}

func TestNorthwingReleaseSigningBindsTimestampAndSignerSPKI(t *testing.T) {
	signScript, err := os.ReadFile("../scripts/sign-northwing-release.ps1")
	if err != nil {
		t.Fatal(err)
	}
	source := string(signScript)
	if strings.Contains(source, "GITHUB_ENV") {
		t.Fatal("signing credential material must not be exported to the whole GitHub job")
	}
	for _, want := range []string{
		"exactly one private key certificate",
		"NORTHWING_MANIFEST_SPKI_BASE64",
		"FixedTimeEquals",
		"SignerCertificate",
		"RequireWindowsKits",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("signing identity contract missing %q", want)
		}
	}
	fd := strings.Index(source, "/fd SHA256")
	tr := strings.Index(source, "/tr https://timestamp.digicert.com")
	td := strings.Index(source, "/td SHA256")
	if fd < 0 || tr <= fd || td <= tr {
		t.Fatal("signtool must use /fd SHA256 followed by /tr and then /td SHA256")
	}
}

func TestNorthwingReleaseTagResolverTreatsTagAsData(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Northwing release workflow runs on Windows")
	}
	pwsh, err := exec.LookPath("pwsh")
	if err != nil {
		t.Skip("pwsh is unavailable")
	}
	config := filepath.Join(t.TempDir(), "wails.json")
	if err := os.WriteFile(config, []byte(`{"info":{"productVersion":"0.3.0"}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	resolver, err := filepath.Abs("../scripts/resolve-northwing-release-version.ps1")
	if err != nil {
		t.Fatal(err)
	}
	valid := exec.Command(pwsh, "-NoProfile", "-File", resolver, "-Tag", "northwing-v0.3.0", "-WailsConfig", config)
	if output, err := valid.CombinedOutput(); err != nil || strings.TrimSpace(string(output)) != "0.3.0" {
		t.Fatalf("valid release tag resolution failed: %v\n%s", err, output)
	}

	marker := filepath.Join(t.TempDir(), "injected.txt")
	maliciousTag := "northwing-v0.3.0'; Set-Content -LiteralPath '" + marker + "' -Value injected; #'"
	malicious := exec.Command(pwsh, "-NoProfile", "-File", resolver, "-Tag", maliciousTag, "-WailsConfig", config)
	if output, err := malicious.CombinedOutput(); err == nil {
		t.Fatalf("malicious release tag unexpectedly succeeded: %s", output)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatalf("release tag was evaluated as PowerShell source; marker error: %v", err)
	}
}

func TestNorthwingReleaseCheckoutGuardRejectsUntrackedCompileInput(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Northwing release workflow runs on Windows")
	}
	pwsh, err := exec.LookPath("pwsh")
	if err != nil {
		t.Skip("pwsh is unavailable")
	}
	git, err := exec.LookPath("git")
	if err != nil {
		t.Skip("git is unavailable")
	}
	repo := t.TempDir()
	runGit := func(args ...string) {
		t.Helper()
		cmd := exec.Command(git, args...)
		cmd.Dir = repo
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, output)
		}
	}
	runGit("init")
	runGit("config", "user.email", "northwing-test@example.invalid")
	runGit("config", "user.name", "Northwing Test")
	if err := os.WriteFile(filepath.Join(repo, "main.go"), []byte("package main\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	runGit("add", "main.go")
	runGit("commit", "-m", "fixture")
	guard, err := filepath.Abs("../scripts/assert-northwing-release-checkout-clean.ps1")
	if err != nil {
		t.Fatal(err)
	}
	clean := exec.Command(pwsh, "-NoProfile", "-File", guard, "-RepositoryRoot", repo)
	if output, err := clean.CombinedOutput(); err != nil {
		t.Fatalf("clean release checkout was rejected: %v\n%s", err, output)
	}

	injected := "injected_windows.go"
	if err := os.WriteFile(filepath.Join(repo, injected), []byte("package main\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	dirty := exec.Command(pwsh, "-NoProfile", "-File", guard, "-RepositoryRoot", repo)
	output, err := dirty.CombinedOutput()
	if err == nil {
		t.Fatalf("untracked compile input unexpectedly passed release checkout guard: %s", output)
	}
	if !strings.Contains(string(output), injected) {
		t.Fatalf("checkout guard did not identify injected compile input: %v\n%s", err, output)
	}
}

func TestNorthwingReleaseWindowsVerifierPreservesAbsoluteArtifactDirectory(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Northwing Windows verification requires Windows")
	}
	pwsh, err := exec.LookPath("pwsh")
	if err != nil {
		t.Skip("pwsh is unavailable")
	}
	outputDir := t.TempDir()
	verifier, err := filepath.Abs("../scripts/verify-northwing-windows.ps1")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.Command(pwsh, "-NoProfile", "-File", verifier,
		"-Version", "0.3.0", "-OutputDir", outputDir, "-AllowUnsignedTestArtifact")
	output, err := command.CombinedOutput()
	if err == nil {
		t.Fatalf("empty release artifact directory unexpectedly verified: %s", output)
	}
	expectedArtifactName := "Northwing-0.3.0-windows-x64-setup.exe"
	if !strings.Contains(string(output), expectedArtifactName) {
		t.Fatalf("absolute artifact directory was prefixed with the repository root: %v\n%s", err, output)
	}
	repositoryRoot, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	malformedPrefix := repositoryRoot + string(os.PathSeparator) + outputDir
	if strings.Contains(string(output), malformedPrefix) {
		t.Fatalf("absolute artifact directory was prefixed with the repository root: %v\n%s", err, output)
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
		"ExpectedSignerSPKIBase64",
		"FixedTimeEquals",
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
		"ExpectedSignerSPKIBase64",
		"FixedTimeEquals",
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
		"-Version", "0.3.0", "-OutputDir", t.TempDir(), "-PayloadDir", payloadDir, "-ValidatePayloadOnly", "-ExpectedSignerSPKIBase64", "AA==")
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
