// Package northwing provides Northwing release identity, asset naming,
// and update-manifest types shared across the desktop and release tooling.
package northwing

import (
	"fmt"
	"os"
)

const (
	// ReleaseRepository is the canonical GitHub owner/repo for Northwing releases.
	ReleaseRepository = "holobunganan-sketch/DeepSeek-Reasonix"

	// ReleasePageURL is the human-facing releases page.
	ReleasePageURL = "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases"

	// ProductName is the user-visible product identifier.
	ProductName = "Northwing"
)

// LatestReleaseAPIURL returns the GitHub API endpoint for the latest release.
// Production callers must use this value only after verifying the response
// against a signed manifest trust root.
const LatestReleaseAPIURL = "https://api.github.com/repos/holobunganan-sketch/DeepSeek-Reasonix/releases/latest"

// WindowsSetupAssetName returns the canonical setup filename for a given version.
func WindowsSetupAssetName(version string) string {
	return "Northwing-" + version + "-windows-x64-setup.exe"
}

// WindowsPortableAssetName returns the canonical portable filename for a given version.
func WindowsPortableAssetName(version string) string {
	return "Northwing-" + version + "-windows-x64-portable.zip"
}

// ChecksumAssetName returns the canonical SHA-256 checksum filename.
func ChecksumAssetName(version string) string {
	return "Northwing-" + version + "-SHA256SUMS.txt"
}

// UpdateManifestName returns the public update manifest filename.
func UpdateManifestName() string {
	return "northwing-update.json"
}

// UpdateManifestSigName returns the detached signature filename.
func UpdateManifestSigName() string {
	return "northwing-update.json.sig"
}

// HelperExeName returns the update-helper executable name.
func HelperExeName() string {
	return "northwing-update-helper.exe"
}

// SigningStatus reports whether Authenticode and manifest signing credentials
// are available for a formal Northwing release.
type SigningStatus int

const (
	// SigningMissing means no signing credential is configured and a formal
	// release must not be published.
	SigningMissing SigningStatus = iota

	// SigningService means signing is delegated to a CI service such as
	// SignPath or Azure Trusted Signing.
	SigningService

	// SigningPresent means a local code-signing certificate is available.
	SigningPresent
)

// ReleaseSigningStatus returns the current signing credential state.
// In CI this is derived from environment variables. In local builds
// it returns SigningMissing by default.
func ReleaseSigningStatus() SigningStatus {
	if token, ok := os.LookupEnv("SIGNPATH_API_TOKEN"); ok && token != "" {
		return SigningService
	}
	if token, ok := os.LookupEnv("AZURE_TRUSTED_SIGNING_CLIENT_SECRET"); ok && token != "" {
		return SigningService
	}
	certPath, ok := os.LookupEnv("NORTHWING_SIGNING_CERTIFICATE")
	if !ok || certPath == "" {
		return SigningMissing
	}
	return SigningPresent
}

// RequiresSigning verifies that a signing credential is available.
// Returns nil if signing is configured; returns an error otherwise with
// instructions for what credentials are missing.
func RequiresSigning() error {
	if ReleaseSigningStatus() == SigningMissing {
		return fmt.Errorf("Northwing formal release requires one of: SIGNPATH_API_TOKEN, AZURE_TRUSTED_SIGNING_CLIENT_SECRET, or NORTHWING_SIGNING_CERTIFICATE")
	}
	return nil
}
