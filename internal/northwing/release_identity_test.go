package northwing

import "testing"

func TestReleaseIdentityRepositoryNotEmpty(t *testing.T) {
	if ReleaseRepository == "" {
		t.Fatal("ReleaseRepository must not be empty")
	}
}

func TestReleaseIdentityAssetNaming(t *testing.T) {
	name := WindowsSetupAssetName("0.3.0")
	if len(name) == 0 {
		t.Fatal("asset name must not be empty")
	}
}

func TestReleaseIdentityManifestName(t *testing.T) {
	name := UpdateManifestName()
	if len(name) == 0 {
		t.Fatal("manifest name must not be empty")
	}
}

func TestReleaseIdentityReleasePageNotEmpty(t *testing.T) {
	if ReleasePageURL == "" {
		t.Fatal("ReleasePageURL must not be empty")
	}
}

func TestReleaseIdentityLatestReleaseAPI(t *testing.T) {
	if LatestReleaseAPIURL == "" {
		t.Fatal("LatestReleaseAPIURL must not be empty")
	}
}

func TestReleaseRequiresSigningReturnsErrorWithoutCredentials(t *testing.T) {
	t.Setenv("SIGNPATH_API_TOKEN", "")
	t.Setenv("AZURE_TRUSTED_SIGNING_CLIENT_SECRET", "")
	t.Setenv("NORTHWING_SIGNING_CERTIFICATE", "")
	if err := RequiresSigning(); err == nil {
		t.Fatal("RequiresSigning must return an error when no signing credential is configured")
	}
}

func TestReleaseRequiresSigningReturnsNilWithSignPathToken(t *testing.T) {
	t.Setenv("SIGNPATH_API_TOKEN", "test-token")
	if err := RequiresSigning(); err != nil {
		t.Fatalf("RequiresSigning must not return an error when SIGNPATH_API_TOKEN is set: %v", err)
	}
}

func TestReleaseRequiresSigningReturnsNilWithAzureToken(t *testing.T) {
	t.Setenv("SIGNPATH_API_TOKEN", "")
	t.Setenv("AZURE_TRUSTED_SIGNING_CLIENT_SECRET", "azure-secret")
	if err := RequiresSigning(); err != nil {
		t.Fatalf("RequiresSigning must not return an error when AZURE_TRUSTED_SIGNING_CLIENT_SECRET is set: %v", err)
	}
}

func TestReleaseRequiresSigningReturnsNilWithLocalCertificate(t *testing.T) {
	t.Setenv("SIGNPATH_API_TOKEN", "")
	t.Setenv("AZURE_TRUSTED_SIGNING_CLIENT_SECRET", "")
	t.Setenv("NORTHWING_SIGNING_CERTIFICATE", "/path/to/cert.pfx")
	if err := RequiresSigning(); err != nil {
		t.Fatalf("RequiresSigning must return nil when NORTHWING_SIGNING_CERTIFICATE is set: %v", err)
	}
}

func TestReleaseSigningStatusDefaultsToMissing(t *testing.T) {
	t.Setenv("SIGNPATH_API_TOKEN", "")
	t.Setenv("AZURE_TRUSTED_SIGNING_CLIENT_SECRET", "")
	t.Setenv("NORTHWING_SIGNING_CERTIFICATE", "")
	if status := ReleaseSigningStatus(); status != SigningMissing {
		t.Fatalf("expected SigningMissing, got %d", status)
	}
}
