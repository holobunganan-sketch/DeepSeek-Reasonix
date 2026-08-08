package main

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/json"
	"testing"

	"reasonix/internal/northwing"
)

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
		PublishedAt:   "2026-08-08T00:00:00Z",
		Repository:    northwing.ReleaseRepository,
		ReleaseNotes:  "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/tag/northwing-v0.3.0",
		Assets: []NorthwingUpdateAsset{
			{
				Name:     northwing.WindowsSetupAssetName("0.3.0"),
				URL:      "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v0.3.0/" + northwing.WindowsSetupAssetName("0.3.0"),
				Size:     104857600,
				SHA256:   "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
	m.Assets[0].URL = "http://github.com/asset.exe"
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("non-HTTPS asset was accepted")
	}
}

func TestParseManifestRejectsForeignHostAsset(t *testing.T) {
	m := testManifest(t)
	m.Assets[0].URL = "https://evil.invalid/asset.exe"
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
	m.Assets[0].SHA256 = "not-a-hash"
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
	m.Assets[0].Name = "../etc/passwd"
	data, _ := json.Marshal(m)
	if _, err := ParseNorthwingManifest(data); err == nil {
		t.Fatal("path-traversal asset name was accepted")
	}
}

func TestParseManifestRejectsZeroAssetSize(t *testing.T) {
	m := testManifest(t)
	m.Assets[0].Size = 0
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

