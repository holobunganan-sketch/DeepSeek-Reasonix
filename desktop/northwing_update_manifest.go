package main

import (
	"bytes"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"reasonix/internal/northwing"
	"regexp"
	"strings"
	"time"

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
	SchemaVersion int                             `json:"schemaVersion"`
	Product       string                          `json:"product"`
	Version       string                          `json:"version"`
	Channel       string                          `json:"channel"`
	PublishedAt   time.Time                       `json:"publishedAt"`
	Repository    string                          `json:"repository"`
	ReleaseNotes  string                          `json:"releaseNotes"`
	Assets        map[string]NorthwingUpdateAsset `json:"assets"`
}

// northwingManifestPublicKeySPKIBase64 is set with -X for signed release
// builds. Empty values deliberately leave the updater in manual-only mode.
var northwingManifestPublicKeySPKIBase64 string

var (
	northwingSafeNameRE = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+\-]*$`)
	northwingGitHubHost = "github.com"
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

func parseNorthwingManifestPublicKey(encoded string) (*rsa.PublicKey, error) {
	encoded = strings.TrimSpace(encoded)
	if encoded == "" {
		return nil, errors.New("northwing update manifest: public key is empty")
	}
	der, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("northwing update manifest: decode public key: %w", err)
	}
	parsed, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, fmt.Errorf("northwing update manifest: parse public key: %w", err)
	}
	pub, ok := parsed.(*rsa.PublicKey)
	if !ok || pub.N == nil || pub.E < 3 || pub.N.BitLen() < 2048 {
		return nil, errors.New("northwing update manifest: public key is not a supported RSA key")
	}
	return pub, nil
}

func parseVerifiedNorthwingManifest(data, signature []byte, pub *rsa.PublicKey) (*NorthwingUpdateManifest, error) {
	if err := VerifyNorthwingManifest(data, signature, pub); err != nil {
		return nil, err
	}
	return ParseNorthwingManifest(data)
}

// ParseNorthwingManifest strict-decodes a serialised manifest. The caller
// MUST have already verified the detached signature via
// VerifyNorthwingManifest.
func ParseNorthwingManifest(data []byte) (*NorthwingUpdateManifest, error) {
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return nil, errors.New("northwing update manifest: empty body")
	}
	if err := rejectDuplicateJSONKeys(data); err != nil {
		return nil, err
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

func rejectDuplicateJSONKeys(data []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	return scanNorthwingJSONValue(decoder)
}

func scanNorthwingJSONValue(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if err != nil {
		return nil // The strict decoder returns the primary JSON error.
	}
	switch token := token.(type) {
	case json.Delim:
		switch token {
		case '{':
			seen := map[string]struct{}{}
			for decoder.More() {
				key, err := decoder.Token()
				if err != nil {
					return nil
				}
				name, ok := key.(string)
				if !ok {
					return errors.New("northwing update manifest: invalid object key")
				}
				if _, duplicate := seen[name]; duplicate {
					return fmt.Errorf("northwing update manifest: duplicate JSON key %q", name)
				}
				seen[name] = struct{}{}
				if err := scanNorthwingJSONValue(decoder); err != nil {
					return err
				}
			}
			_, _ = decoder.Token()
		case '[':
			for decoder.More() {
				if err := scanNorthwingJSONValue(decoder); err != nil {
					return err
				}
			}
			_, _ = decoder.Token()
		}
	}
	return nil
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
	if !isNorthwingStableVersion(m.Version) {
		return fmt.Errorf("northwing update manifest: invalid semver %q", m.Version)
	}
	if m.Channel != "stable" {
		return fmt.Errorf("northwing update manifest: unsupported channel %q", m.Channel)
	}
	if m.PublishedAt.IsZero() {
		return errors.New("northwing update manifest: publishedAt is required")
	}
	if m.ReleaseNotes != northwing.ReleasePageURL+"/tag/"+northwing.ReleaseTag(m.Version) {
		return errors.New("northwing update manifest: release notes URL does not match the declared release")
	}

	if len(m.Assets) != 1 {
		return errors.New("northwing update manifest: requires exactly one windows-x64 asset")
	}
	asset, ok := m.Assets["windows-x64"]
	if !ok {
		return errors.New("northwing update manifest: missing windows-x64 asset")
	}
	if err := validateNorthwingAsset(m.Version, asset); err != nil {
		return fmt.Errorf("northwing update manifest: windows-x64 asset: %w", err)
	}
	return nil
}

func isNorthwingStableVersion(version string) bool {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	if !semver.IsValid("v"+version) || strings.ContainsAny(version, "+-") {
		return false
	}
	return northwingTagRE.MatchString(northwing.ReleaseTag(version))
}

func validateNorthwingAsset(version string, a NorthwingUpdateAsset) error {
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
	if !strings.EqualFold(u.Hostname(), northwingGitHubHost) || u.Port() != "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return fmt.Errorf("asset host %q is not the release host", u.Host)
	}
	tag := northwing.ReleaseTag(version)
	if a.Name != northwing.WindowsSetupAssetName(version) || u.String() != northwing.ReleaseDownloadURL(tag, a.Name) {
		return errors.New("asset URL does not match the declared repository, tag, version, and name")
	}

	if a.Size <= 0 {
		return fmt.Errorf("invalid asset size %d", a.Size)
	}
	if !northwingSHA256RE.MatchString(a.SHA256) {
		return fmt.Errorf("invalid SHA-256 %q", a.SHA256)
	}
	return nil
}

// LatestNorthwingManifestURL returns the public URL for the update manifest.
func LatestNorthwingManifestURL() string {
	return northwing.LatestReleaseDownloadURL(northwing.UpdateManifestName())
}

// LatestNorthwingManifestSigURL returns the public URL for the detached signature.
func LatestNorthwingManifestSigURL() string {
	return northwing.LatestReleaseDownloadURL(northwing.UpdateManifestSigName())
}
