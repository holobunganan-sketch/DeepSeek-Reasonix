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
