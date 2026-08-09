package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"reasonix/internal/northwing"
)

func TestVerifiedManifestRejectsSignatureBeforeParsing(t *testing.T) {
	key := testManifestKey(t)
	if _, err := parseVerifiedNorthwingManifest([]byte(`{"not":"valid JSON"}`), []byte("tampered"), &key.PublicKey); err == nil {
		t.Fatal("invalid signature reached JSON parsing")
	}
}

func TestManifestPublicKeyRejectsEmptyMalformedAndForeignKeys(t *testing.T) {
	if _, err := parseNorthwingManifestPublicKey(""); err == nil {
		t.Fatal("empty manifest key was accepted")
	}
	if _, err := parseNorthwingManifestPublicKey("not-base64"); err == nil {
		t.Fatal("malformed manifest key was accepted")
	}
	key := testManifestKey(t)
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseNorthwingManifestPublicKey(base64.StdEncoding.EncodeToString(der)); err != nil {
		t.Fatalf("valid SPKI public key rejected: %v", err)
	}
}

func TestLoadVerifiedNorthwingManifestUsesOnlySignedManifestEndpoints(t *testing.T) {
	key := testManifestKey(t)
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	manifest := testManifest(t)
	data, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	signature := signManifest(t, manifest, key)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/northwing-update.json":
			_, _ = w.Write(data)
		case "/northwing-update.json.sig":
			_, _ = w.Write(signature)
		default:
			t.Fatalf("runtime asked for an unsigned release endpoint: %s", r.URL.Path)
		}
	}))
	defer server.Close()
	oldKey, oldManifestURL, oldSigURL := northwingManifestPublicKeySPKIBase64, northwingManifestURL, northwingManifestSigURL
	t.Cleanup(func() {
		northwingManifestPublicKeySPKIBase64, northwingManifestURL, northwingManifestSigURL = oldKey, oldManifestURL, oldSigURL
	})
	northwingManifestPublicKeySPKIBase64 = base64.StdEncoding.EncodeToString(der)
	northwingManifestURL = server.URL + "/northwing-update.json"
	northwingManifestSigURL = server.URL + "/northwing-update.json.sig"
	loaded, err := loadVerifiedNorthwingManifest(t.Context(), server.Client())
	if err != nil {
		t.Fatalf("load signed manifest: %v", err)
	}
	setup, ok := northwingManifestSetup(loaded)
	if !ok || setup.Name != northwing.WindowsSetupAssetName("0.3.0") {
		t.Fatalf("verified manifest did not authorize the exact Windows setup: %+v", setup)
	}
}

func testManifestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate test key: %v", err)
	}
	return key
}

func testManifest(t *testing.T) NorthwingUpdateManifest {
	return NorthwingUpdateManifest{
		SchemaVersion: 1,
		Product:       northwing.ProductName,
		Version:       "0.3.0",
		Channel:       "stable",
		PublishedAt:   time.Date(2026, 8, 8, 0, 0, 0, 0, time.UTC),
		Repository:    northwing.ReleaseRepository,
		ReleaseNotes:  "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/tag/northwing-v0.3.0",
		Assets: map[string]NorthwingUpdateAsset{
			"windows-x64": {
				Name:   northwing.WindowsSetupAssetName("0.3.0"),
				URL:    "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v0.3.0/" + northwing.WindowsSetupAssetName("0.3.0"),
				Size:   104857600,
				SHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			},
		},
	}
}

func signManifest(t *testing.T, m NorthwingUpdateManifest, key *rsa.PrivateKey) []byte {
	t.Helper()
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("marshal manifest: %v", err)
	}
	hash := sha256.Sum256(data)
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		t.Fatalf("sign manifest: %v", err)
	}
	return sig
}

func TestVerifyManifestSignatureRejectsEmptySignature(t *testing.T) {
	key := testManifestKey(t)
	m := testManifest(t)
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyNorthwingManifest(data, nil, &key.PublicKey); err == nil {
		t.Fatal("empty signature was accepted")
	}
}

func TestVerifyManifestSignatureRejectsTamperedManifest(t *testing.T) {
	key := testManifestKey(t)
	m := testManifest(t)
	sig := signManifest(t, m, key)
	m.Version = "0.2.0"
	data, _ := json.Marshal(m)
	if err := VerifyNorthwingManifest(data, sig, &key.PublicKey); err == nil {
		t.Fatal("tampered manifest was accepted")
	}
}

func TestVerifyManifestSignatureRejectsForeignKey(t *testing.T) {
	key := testManifestKey(t)
	foreignKey := testManifestKey(t)
	m := testManifest(t)
	sig := signManifest(t, m, key)
	data, _ := json.Marshal(m)
	if err := VerifyNorthwingManifest(data, sig, &foreignKey.PublicKey); err == nil {
		t.Fatal("foreign key signature was accepted")
	}
}

func TestVerifyManifestSignatureAcceptsValidSignature(t *testing.T) {
	key := testManifestKey(t)
	m := testManifest(t)
	sig := signManifest(t, m, key)
	data, _ := json.Marshal(m)
	if err := VerifyNorthwingManifest(data, sig, &key.PublicKey); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
}

func TestParseManifestRejectsUnknownFields(t *testing.T) {
	raw := []byte(`{"schemaVersion":1,"product":"Northwing","version":"0.3.0","channel":"stable","publishedAt":"2026-08-08T00:00:00Z","repository":"holobunganan-sketch/DeepSeek-Reasonix","releaseNotes":"https://example.com","assets":[],"extraField":"should fail"}`)
	_, err := ParseNorthwingManifest(raw)
	if err == nil {
		t.Fatal("unknown field was accepted")
	}
}

func TestParseManifestRejectsTrailingJSON(t *testing.T) {
	raw := []byte(`{"schemaVersion":1,"product":"Northwing","version":"0.3.0","channel":"stable","publishedAt":"2026-08-08T00:00:00Z","repository":"holobunganan-sketch/DeepSeek-Reasonix","releaseNotes":"https://example.com","assets":[]}extra`)
	_, err := ParseNorthwingManifest(raw)
	if err == nil {
		t.Fatal("trailing content was accepted")
	}
}

func TestParseManifestRejectsWrongProduct(t *testing.T) {
	m := testManifest(t)
	m.Product = "NotNorthwing"
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("wrong product was accepted")
	}
}

func TestParseManifestRejectsForeignRepository(t *testing.T) {
	m := testManifest(t)
	m.Repository = "evil/not-northwing"
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("foreign repository was accepted")
	}
}

func TestParseManifestRejectsNonHTTPSAsset(t *testing.T) {
	m := testManifest(t)
	asset := m.Assets["windows-x64"]
	asset.URL = "http://github.com/asset.exe"
	m.Assets["windows-x64"] = asset
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("non-HTTPS asset was accepted")
	}
}

func TestParseManifestRejectsWrongAssetPathAndDuplicateWindowsAsset(t *testing.T) {
	m := testManifest(t)
	asset := m.Assets["windows-x64"]
	asset.URL = northwing.ReleaseDownloadURL(northwing.ReleaseTag(m.Version), "other-setup.exe")
	m.Assets["windows-x64"] = asset
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("wrong release asset path was accepted")
	}

	data, _ = json.Marshal(testManifest(t))
	needle := []byte(`"windows-x64":`)
	data = bytes.Replace(data, needle, []byte(`"windows-x64":{"name":"ignored"},"windows-x64":`), 1)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("duplicate Windows asset was accepted")
	}
}

func TestParseManifestRejectsDuplicateKeysAtEveryObjectLevel(t *testing.T) {
	data, _ := json.Marshal(testManifest(t))
	cases := []struct {
		name    string
		needle  []byte
		replace []byte
	}{
		{"top-level version", []byte(`"version":"0.3.0"`), []byte(`"version":"0.3.0","version":"0.3.0"`)},
		{"top-level assets", []byte(`"assets":`), []byte(`"assets":{},"assets":`)},
		{"platform key", []byte(`"windows-x64":`), []byte(`"windows-x64":{},"windows-x64":`)},
		{"asset field", []byte(`"sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"`), []byte(`"sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"`)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			duplicate := bytes.Replace(data, tc.needle, tc.replace, 1)
			if _, err := ParseNorthwingManifest(duplicate); err == nil {
				t.Fatal("duplicate JSON key was accepted")
			}
		})
	}
}

func TestParseManifestRejectsStablePrereleaseAndBuildMetadata(t *testing.T) {
	for _, version := range []string{"0.3.1-rc.1", "0.3.1+build.1"} {
		t.Run(version, func(t *testing.T) {
			m := testManifest(t)
			m.Version = version
			asset := m.Assets["windows-x64"]
			asset.Name = northwing.WindowsSetupAssetName(version)
			asset.URL = northwing.ReleaseDownloadURL(northwing.ReleaseTag(version), asset.Name)
			m.Assets["windows-x64"] = asset
			m.ReleaseNotes = northwing.ReleasePageURL + "/tag/" + northwing.ReleaseTag(version)
			data, _ := json.Marshal(m)
			if _, err := ParseNorthwingManifest(data); err == nil {
				t.Fatal("stable manifest accepted prerelease or build metadata")
			}
		})
	}
}

func TestParseManifestRejectsForeignHostAsset(t *testing.T) {
	m := testManifest(t)
	asset := m.Assets["windows-x64"]
	asset.URL = "https://evil.invalid/asset.exe"
	m.Assets["windows-x64"] = asset
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("foreign host asset was accepted")
	}
}

func TestParseManifestRejectsInvalidSemver(t *testing.T) {
	m := testManifest(t)
	m.Version = "not-a-version"
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("invalid semver was accepted")
	}
}

func TestParseManifestAcceptsNewerVersion(t *testing.T) {
	m := testManifest(t)
	m.Version = "1.0.0"
	asset := m.Assets["windows-x64"]
	asset.Name = northwing.WindowsSetupAssetName(m.Version)
	asset.URL = northwing.ReleaseDownloadURL(northwing.ReleaseTag(m.Version), asset.Name)
	m.Assets["windows-x64"] = asset
	m.ReleaseNotes = northwing.ReleasePageURL + "/tag/" + northwing.ReleaseTag(m.Version)
	data, _ := json.Marshal(m)
	parsed, err := ParseNorthwingManifest(data)
	if err != nil {
		t.Fatalf("valid newer version rejected: %v", err)
	}
	if parsed.Version != "1.0.0" {
		t.Fatalf("version = %q", parsed.Version)
	}
}

func TestParseManifestRejectsInvalidSHA256(t *testing.T) {
	m := testManifest(t)
	asset := m.Assets["windows-x64"]
	asset.SHA256 = "not-a-hash"
	m.Assets["windows-x64"] = asset
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("invalid SHA-256 was accepted")
	}
}

func TestParseManifestRejectsEmptyAssets(t *testing.T) {
	m := testManifest(t)
	m.Assets = nil
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("manifest with no assets was accepted")
	}
}

func TestParseManifestRejectsBadAssetName(t *testing.T) {
	m := testManifest(t)
	asset := m.Assets["windows-x64"]
	asset.Name = "../etc/passwd"
	m.Assets["windows-x64"] = asset
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("path-traversal asset name was accepted")
	}
}

func TestParseManifestRejectsZeroAssetSize(t *testing.T) {
	m := testManifest(t)
	asset := m.Assets["windows-x64"]
	asset.Size = 0
	m.Assets["windows-x64"] = asset
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("zero-size asset was accepted")
	}
}

func TestFullVerifyAndParseRoundTrip(t *testing.T) {
	key := testManifestKey(t)
	m := testManifest(t)
	sig := signManifest(t, m, key)
	data, _ := json.Marshal(m)

	if err := VerifyNorthwingManifest(data, sig, &key.PublicKey); err != nil {
		t.Fatalf("verify: %v", err)
	}
	parsed, err := ParseNorthwingManifest(data)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if parsed.Version != "0.3.0" || parsed.Product != northwing.ProductName {
		t.Fatalf("parsed = %+v", parsed)
	}
}
