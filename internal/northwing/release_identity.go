// Package northwing provides Northwing release identity, asset naming,
// and update-manifest types shared across the desktop and release tooling.
package northwing

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
