package main

import (
	"bytes"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"reasonix/internal/northwing"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/mod/semver"

)

// NorthwingUpdateAsset describes a single downloadable release asset.
type NorthwingUpdateAsset struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

// NorthwingUpdateManifest is the signed release manifest distributed
// alongside northwing-update.json.sig.
type NorthwingUpdateManifest struct {
	SchemaVersion int                      `json:"schemaVersion"`
	Product       string                   `json:"product"`
	Version       string                   `json:"version"`
	Channel       string                   `json:"channel"`
	PublishedAt   string                   `json:"publishedAt"`
	Repository    string                   `json:"repository"`
	ReleaseNotes  string                   `json:"releaseNotes"`
	Assets        []NorthwingUpdateAsset   `json:"assets"`
}

var (
	northwingSafeNameRE  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+\-]*$`)
	northwingGitHubHost  = "github.com"
	northwingGitHubCDN   = "objects.githubusercontent.com"
)

// VerifyNorthwingManifest verifies a detached SHA-256 RSA PKCS#1 v1.5
// signature over the serialised manifest. Callers MUST call this before
// ParseNorthwingManifest.
func VerifyNorthwingManifest(data, signature []byte, pub *rsa.PublicKey) error {
	if len(signature) == 0 {
		return errors.New("northwing update manifest: signature is empty")
	}
	if pub == nil {
		return errors.New("northwing update manifest: public key is nil")
	}
	hash := sha256.Sum256(data)
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], signature); err != nil {
		return fmt.Errorf("northwing update manifest: signature verification failed: %w", err)
	}
	return nil
}

// ParseNorthwingManifest strict-decodes a serialised manifest. The caller
// MUST have already verified the detached signature via
// VerifyNorthwingManifest.
func ParseNorthwingManifest(data []byte) (*NorthwingUpdateManifest, error) {
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return nil, errors.New("northwing update manifest: empty body")
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()

	var m NorthwingUpdateManifest
	if err := decoder.Decode(&m); err != nil {
		return nil, fmt.Errorf("northwing update manifest: decode: %w", err)
	}

	// Reject trailing content.
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return nil, errors.New("northwing update manifest: trailing content after JSON")
		}
		// A non-EOF error here means trailing garbage that wasn't valid JSON.
		return nil, fmt.Errorf("northwing update manifest: trailing content: %w", err)
	}

	if err := validateNorthwingManifest(&m); err != nil {
		return nil, err
	}
	return &m, nil
}

func validateNorthwingManifest(m *NorthwingUpdateManifest) error {
	if m.SchemaVersion != 1 {
		return fmt.Errorf("northwing update manifest: unsupported schema version %d", m.SchemaVersion)
	}
	if m.Product != northwing.ProductName {
		return fmt.Errorf("northwing update manifest: unexpected product %q", m.Product)
	}
	if m.Repository != northwing.ReleaseRepository {
		return fmt.Errorf("northwing update manifest: repository mismatch %q", m.Repository)
	}
	if !semver.IsValid("v" + m.Version) {
		return fmt.Errorf("northwing update manifest: invalid semver %q", m.Version)
	}
	if m.Channel != "stable" {
		return fmt.Errorf("northwing update manifest: unsupported channel %q", m.Channel)
	}
	if strings.TrimSpace(m.PublishedAt) == "" {
		return errors.New("northwing update manifest: publishedAt is required")
	}

	if len(m.Assets) == 0 {
		return errors.New("northwing update manifest: no assets")
	}
	for i, a := range m.Assets {
		if err := validateNorthwingAsset(a); err != nil {
			return fmt.Errorf("northwing update manifest: asset %d: %w", i, err)
		}
	}
	return nil
}

func validateNorthwingAsset(a NorthwingUpdateAsset) error {
	a.Name = strings.TrimSpace(a.Name)
	if a.Name == "" || !northwingSafeNameRE.MatchString(a.Name) {
		return fmt.Errorf("invalid asset name %q", a.Name)
	}
	cleaned := filepath.Clean(a.Name)
	if cleaned != a.Name {
		return fmt.Errorf("asset name %q contains path separators", a.Name)
	}

	u, err := url.Parse(a.URL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("asset URL must be HTTPS, got %q", u.Scheme)
	}
	if !isGitHubHost(u.Host) {
		return fmt.Errorf("asset host %q is not a trusted GitHub host", u.Host)
	}

	if a.Size <= 0 {
		return fmt.Errorf("invalid asset size %d", a.Size)
	}
	if !northwingSHA256RE.MatchString(a.SHA256) {
		return fmt.Errorf("invalid SHA-256 %q", a.SHA256)
	}
	return nil
}

func isGitHubHost(host string) bool {
	host = strings.ToLower(host)
	return host == northwingGitHubHost || strings.HasSuffix(host, "."+northwingGitHubHost) ||
		host == northwingGitHubCDN || strings.HasSuffix(host, "."+northwingGitHubCDN)
}

// LatestNorthwingManifestURL returns the public URL for the update manifest.
func LatestNorthwingManifestURL() string {
	return "https://github.com/" + northwing.ReleaseRepository + "/releases/latest/download/" + northwing.UpdateManifestName()
}

// LatestNorthwingManifestSigURL returns the public URL for the detached signature.
func LatestNorthwingManifestSigURL() string {
	return "https://github.com/" + northwing.ReleaseRepository + "/releases/latest/download/" + northwing.UpdateManifestSigName()
}
