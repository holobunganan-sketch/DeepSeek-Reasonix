package main

import "testing"

func TestEvaluateNorthwingRelease(t *testing.T) {
	info := newNorthwingUpdateInfo("0.1.0")
	evaluateNorthwingRelease(info, northwingGitHubRelease{
		TagName: "northwing-v0.2.0",
		HTMLURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/tag/northwing-v0.2.0",
		Body:    "Release notes",
	})
	if !info.Available || info.Latest != "v0.2.0" || info.CanSelfUpdate || !info.ManualOnly {
		t.Fatalf("info = %+v", info)
	}
	if info.DownloadURL == northwingReleasesPage {
		t.Fatalf("release-specific URL was not retained: %+v", info)
	}
}

func TestEvaluateNorthwingReleaseRejectsOtherReleaseLines(t *testing.T) {
	cases := []northwingGitHubRelease{
		{TagName: "v9.9.9"},
		{TagName: "reasonix-v9.9.9"},
		{TagName: "northwing-v0.2.0", Draft: true},
		{TagName: "northwing-v0.2.0-rc.1", Prerelease: true},
	}
	for _, release := range cases {
		info := newNorthwingUpdateInfo("0.1.0")
		evaluateNorthwingRelease(info, release)
		if info.Available || info.Latest != "" {
			t.Fatalf("release %+v was accepted: %+v", release, info)
		}
	}
}

func TestEvaluateNorthwingReleaseDoesNotDowngrade(t *testing.T) {
	info := newNorthwingUpdateInfo("0.3.0")
	evaluateNorthwingRelease(info, northwingGitHubRelease{TagName: "northwing-v0.2.0"})
	if info.Available {
		t.Fatalf("downgrade was offered: %+v", info)
	}
}

func TestEvaluateNorthwingReleaseSelectsVerifiedWindowsInstaller(t *testing.T) {
	info := newNorthwingUpdateInfo("0.1.0")
	evaluateNorthwingRelease(info, northwingGitHubRelease{
		TagName: "northwing-v0.2.0",
		HTMLURL: "https://github.com/holobunganan-sketch/Northwing/releases/tag/northwing-v0.2.0",
		Body:    "Release notes",
		Assets: []northwingGitHubAsset{
			{Name: "Northwing-0.2.0-windows-x64-setup.exe", BrowserDownloadURL: "https://github.com/holobunganan-sketch/Northwing/releases/download/northwing-v0.2.0/Northwing-0.2.0-windows-x64-setup.exe", Size: 42},
			{Name: "Northwing-0.2.0-SHA256SUMS.txt", BrowserDownloadURL: "https://github.com/holobunganan-sketch/Northwing/releases/download/northwing-v0.2.0/Northwing-0.2.0-SHA256SUMS.txt", Size: 128},
		},
	})
	if !info.Available || !info.CanSelfUpdate || info.ManualOnly || info.InstallMode != "installer" || info.AssetSize != 42 {
		t.Fatalf("info = %+v", info)
	}
}

func TestNorthwingReleaseRejectsForeignAssetHost(t *testing.T) {
	info := newNorthwingUpdateInfo("0.1.0")
	evaluateNorthwingRelease(info, northwingGitHubRelease{
		TagName: "northwing-v0.2.0",
		HTMLURL: "https://github.com/holobunganan-sketch/Northwing/releases/tag/northwing-v0.2.0",
		Assets: []northwingGitHubAsset{
			{Name: "Northwing-0.2.0-windows-x64-setup.exe", BrowserDownloadURL: "https://evil.invalid/Northwing-0.2.0-windows-x64-setup.exe", Size: 42},
		},
	})
	if info.CanSelfUpdate {
		t.Fatalf("foreign asset was accepted: %+v", info)
	}
}
