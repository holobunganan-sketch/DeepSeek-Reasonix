package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"reasonix/internal/northwing"
	"runtime"
	"strings"
	"testing"
)

const northwingEphemeralPFXScript = `
$ErrorActionPreference = 'Stop'
$rsa = [Security.Cryptography.RSA]::Create(2048)
$request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
  'CN=Northwing Manifest Integration Test',
  $rsa,
  [Security.Cryptography.HashAlgorithmName]::SHA256,
  [Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$request.CertificateExtensions.Add(
  [Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
    $true
  )
)
$oids = [Security.Cryptography.OidCollection]::new()
$null = $oids.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3'))
$request.CertificateExtensions.Add(
  [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids, $true)
)
$cert = $request.CreateSelfSigned([DateTime]::UtcNow.AddDays(-1), [DateTime]::UtcNow.AddDays(7))
try {
  [IO.File]::WriteAllBytes(
    $env:TEST_PFX_PATH,
    $cert.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $env:TEST_PFX_PASSWORD)
  )
  $publicKey = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($cert)
  try {
    [IO.File]::WriteAllText(
      $env:TEST_SPKI_PATH,
      [Convert]::ToBase64String($publicKey.ExportSubjectPublicKeyInfo()),
      [Text.UTF8Encoding]::new($false)
    )
  } finally { $publicKey.Dispose() }
} finally {
  $cert.Dispose()
  $rsa.Dispose()
}
`

func requirePowerShell(t *testing.T) string {
	t.Helper()
	if runtime.GOOS != "windows" {
		t.Skip("Northwing release manifest integration requires Windows PowerShell and PFX support")
	}
	path, err := exec.LookPath("pwsh")
	if err != nil {
		t.Skip("pwsh is unavailable")
	}
	return path
}

func createNorthwingEphemeralPFX(t *testing.T, pwsh, pfxPath, spkiPath, password string) {
	t.Helper()
	cmd := exec.Command(pwsh, "-NoProfile", "-Command", northwingEphemeralPFXScript)
	cmd.Env = append(os.Environ(),
		"TEST_PFX_PATH="+pfxPath,
		"TEST_SPKI_PATH="+spkiPath,
		"TEST_PFX_PASSWORD="+password,
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("create ephemeral PFX: %v\n%s", err, output)
	}
}

func runNorthwingReleasePowerShell(t *testing.T, pwsh, script string, env []string, args ...string) ([]byte, error) {
	t.Helper()
	commandArgs := append([]string{"-NoProfile", "-File", script}, args...)
	cmd := exec.Command(pwsh, commandArgs...)
	cmd.Env = append(os.Environ(), env...)
	return cmd.CombinedOutput()
}

func assertNorthwingManifestArtifact(t *testing.T, artifactDir string, raw []byte, expectedVersion, expectedRepository string) {
	t.Helper()
	if bytes.HasPrefix(raw, []byte{0xef, 0xbb, 0xbf}) {
		t.Fatal("manifest must not contain a UTF-8 BOM")
	}
	if len(raw) == 0 || raw[len(raw)-1] != '}' {
		t.Fatal("manifest must end with the JSON object and no trailing content")
	}
	manifest, err := ParseNorthwingManifest(raw)
	if err != nil {
		t.Fatalf("strict manifest parse: %v", err)
	}
	if manifest.Product != "Northwing" || manifest.Version != expectedVersion || manifest.Channel != "stable" || manifest.Repository != expectedRepository {
		t.Fatalf("unexpected manifest identity: %+v", manifest)
	}
	if manifest.PublishedAt.IsZero() {
		t.Fatal("manifest publishedAt is empty")
	}
	asset, ok := manifest.Assets["windows-x64"]
	if !ok || len(manifest.Assets) != 1 {
		t.Fatalf("unexpected manifest assets: %+v", manifest.Assets)
	}
	wantName := "Northwing-" + expectedVersion + "-windows-x64-setup.exe"
	wantURL := "https://github.com/" + expectedRepository + "/releases/download/northwing-v" + expectedVersion + "/" + wantName
	if asset.Name != wantName || asset.URL != wantURL {
		t.Fatalf("unexpected Windows asset identity: %+v", asset)
	}
	setup, err := os.ReadFile(filepath.Join(artifactDir, wantName))
	if err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(setup)
	if asset.Size != int64(len(setup)) || asset.SHA256 != hex.EncodeToString(hash[:]) {
		t.Fatalf("manifest setup metadata mismatch: %+v", asset)
	}
}

func TestNorthwingReleaseManifestRoundTripAndTamperResistance(t *testing.T) {
	pwsh := requirePowerShell(t)
	repoRoot := filepath.Clean("..")
	signer := filepath.Join(repoRoot, "scripts", "sign-northwing-manifest.ps1")
	verifier := filepath.Join(repoRoot, "scripts", "verify-northwing-release-signatures.ps1")
	artifactDir := t.TempDir()
	const version = "0.3.0"
	const repository = northwing.ReleaseRepository
	const password = "Northwing-Manifest-Test-42!"
	setupName := "Northwing-" + version + "-windows-x64-setup.exe"
	if err := os.WriteFile(filepath.Join(artifactDir, setupName), []byte("signed setup fixture bytes\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	pfxPath := filepath.Join(artifactDir, "release.pfx")
	spkiPath := filepath.Join(artifactDir, "release.spki")
	createNorthwingEphemeralPFX(t, pwsh, pfxPath, spkiPath, password)
	env := []string{"NORTHWING_RELEASE_PFX=" + pfxPath, "NORTHWING_RELEASE_PFX_PASSWORD=" + password}

	if output, err := runNorthwingReleasePowerShell(t, pwsh, signer, env,
		"-Version", version, "-ArtifactDir", artifactDir, "-Repository", repository); err != nil {
		t.Fatalf("sign manifest: %v\n%s", err, output)
	}
	if output, err := runNorthwingReleasePowerShell(t, pwsh, verifier, env,
		"-Version", version, "-ArtifactDir", artifactDir, "-Repository", repository); err != nil {
		t.Fatalf("independent manifest verifier: %v\n%s", err, output)
	}

	manifestPath := filepath.Join(artifactDir, "northwing-update.json")
	signaturePath := filepath.Join(artifactDir, "northwing-update.json.sig")
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	signature, err := os.ReadFile(signaturePath)
	if err != nil {
		t.Fatal(err)
	}
	spki, err := os.ReadFile(spkiPath)
	if err != nil {
		t.Fatal(err)
	}
	publicKey, err := parseNorthwingManifestPublicKey(strings.TrimSpace(string(spki)))
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyNorthwingManifest(raw, signature, publicKey); err != nil {
		t.Fatalf("Go signature verifier rejected PowerShell output: %v", err)
	}
	assertNorthwingManifestArtifact(t, artifactDir, raw, version, repository)

	if err := os.WriteFile(manifestPath, append(append([]byte(nil), raw...), ' '), 0o600); err != nil {
		t.Fatal(err)
	}
	if output, err := runNorthwingReleasePowerShell(t, pwsh, verifier, env,
		"-Version", version, "-ArtifactDir", artifactDir, "-Repository", repository); err == nil {
		t.Fatalf("tampered manifest unexpectedly verified: %s", output)
	}
	if err := os.WriteFile(manifestPath, raw, 0o600); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(signaturePath, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if output, err := runNorthwingReleasePowerShell(t, pwsh, verifier, env,
		"-Version", version, "-ArtifactDir", artifactDir, "-Repository", repository); err == nil {
		t.Fatalf("empty signature unexpectedly verified: %s", output)
	}
	if err := os.WriteFile(signaturePath, signature, 0o600); err != nil {
		t.Fatal(err)
	}

	foreignPFX := filepath.Join(artifactDir, "foreign.pfx")
	foreignSPKI := filepath.Join(artifactDir, "foreign.spki")
	createNorthwingEphemeralPFX(t, pwsh, foreignPFX, foreignSPKI, password)
	foreignEnv := []string{"NORTHWING_RELEASE_PFX=" + foreignPFX, "NORTHWING_RELEASE_PFX_PASSWORD=" + password}
	if output, err := runNorthwingReleasePowerShell(t, pwsh, verifier, foreignEnv,
		"-Version", version, "-ArtifactDir", artifactDir, "-Repository", repository); err == nil {
		t.Fatalf("foreign certificate unexpectedly verified manifest: %s", output)
	}
}

func TestNorthwingReleaseManifestFormalArtifacts(t *testing.T) {
	artifactDir := strings.TrimSpace(os.Getenv("NORTHWING_RELEASE_ARTIFACT_DIR"))
	encodedSPKI := strings.TrimSpace(os.Getenv("NORTHWING_MANIFEST_SPKI_BASE64"))
	if artifactDir == "" || encodedSPKI == "" {
		t.Skip("formal release artifact verification requires both artifact directory and manifest SPKI")
	}
	raw, err := os.ReadFile(filepath.Join(artifactDir, "northwing-update.json"))
	if err != nil {
		t.Fatal(err)
	}
	signature, err := os.ReadFile(filepath.Join(artifactDir, "northwing-update.json.sig"))
	if err != nil {
		t.Fatal(err)
	}
	publicKey, err := parseNorthwingManifestPublicKey(encodedSPKI)
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyNorthwingManifest(raw, signature, publicKey); err != nil {
		t.Fatal(err)
	}
	manifest, err := ParseNorthwingManifest(raw)
	if err != nil {
		t.Fatal(err)
	}
	assertNorthwingManifestArtifact(t, artifactDir, raw, manifest.Version, manifest.Repository)
}
