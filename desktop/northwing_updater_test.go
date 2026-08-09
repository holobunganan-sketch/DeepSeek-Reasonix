package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"testing"
)

type northwingNoRequestTransport struct{ t *testing.T }

func (r northwingNoRequestTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	r.t.Fatalf("runtime requested bypass endpoint %s", req.URL)
	return nil, errors.New("unexpected request")
}

func installNorthwingUpdateTestSeam(t *testing.T, manifests ...*NorthwingUpdateManifest) (downloads, handoffs *int) {
	t.Helper()
	oldClient, oldLoader, oldPlatform := northwingUpdateHTTPClient, northwingUpdateManifestLoader, northwingUpdatePlatform
	oldDownload, oldCopy, oldHandoff := northwingInstallerDownloader, northwingUpdateHelperCopier, northwingUpdateHandoff
	loadCount, downloadCount, handoffCount := 0, 0, 0
	northwingUpdateHTTPClient = func(bool) (*http.Client, error) {
		return &http.Client{Transport: northwingNoRequestTransport{t}}, nil
	}
	northwingUpdateManifestLoader = func(context.Context, *http.Client) (*NorthwingUpdateManifest, error) {
		if loadCount >= len(manifests) {
			return nil, errors.New("unexpected manifest reload")
		}
		manifest := manifests[loadCount]
		loadCount++
		return manifest, nil
	}
	northwingUpdatePlatform = func() (string, string) { return "windows", "amd64" }
	northwingInstallerDownloader = func(context.Context, *http.Client, northwingGitHubAsset, string, string, func(int64, int64)) error {
		downloadCount++
		return nil
	}
	northwingUpdateHelperCopier = func(string) error { return nil }
	northwingUpdateHandoff = func(_ *App, _, _, _, _, stagingDir string, _ int64) error {
		handoffCount++
		return os.RemoveAll(stagingDir)
	}
	t.Cleanup(func() {
		northwingUpdateHTTPClient, northwingUpdateManifestLoader, northwingUpdatePlatform = oldClient, oldLoader, oldPlatform
		northwingInstallerDownloader, northwingUpdateHelperCopier, northwingUpdateHandoff = oldDownload, oldCopy, oldHandoff
	})
	return &downloadCount, &handoffCount
}

func updaterManifest(version string) *NorthwingUpdateManifest {
	name := "Northwing-" + version + "-windows-x64-setup.exe"
	return &NorthwingUpdateManifest{
		Version: version,
		Assets:  map[string]NorthwingUpdateAsset{"windows-x64": {Name: name, URL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v" + version + "/" + name, Size: 1, SHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}},
	}
}

func TestNorthwingCheckAndApplyReverifyWithoutReleaseJSONFallback(t *testing.T) {
	downloads, handoffs := installNorthwingUpdateTestSeam(t, updaterManifest("0.3.1"), updaterManifest("0.3.2"))
	app := &App{}
	info, err := app.CheckNorthwingUpdate()
	if err != nil || info.Latest != "v0.3.1" {
		t.Fatalf("check did not use verified manifest: info=%+v err=%v", info, err)
	}
	err = app.ApplyNorthwingUpdateRequest("0.3.1", "request-13")
	if err == nil {
		t.Fatal("Apply accepted manifest version drift")
	}
	if *downloads != 0 || *handoffs != 0 {
		t.Fatalf("version drift reached installer download or handoff: downloads=%d handoffs=%d", *downloads, *handoffs)
	}
}

func TestNorthwingCheckAndApplyVerifiedManifestDownloadsOnce(t *testing.T) {
	downloads, handoffs := installNorthwingUpdateTestSeam(t, updaterManifest("0.3.1"), updaterManifest("0.3.1"))
	app := &App{}
	if _, err := app.CheckNorthwingUpdate(); err != nil {
		t.Fatalf("CheckNorthwingUpdate: %v", err)
	}
	if err := app.ApplyNorthwingUpdateRequest("0.3.1", "request-14"); err != nil {
		t.Fatalf("ApplyNorthwingUpdateRequest: %v", err)
	}
	if *downloads != 1 || *handoffs != 1 {
		t.Fatalf("verified path calls: downloads=%d handoffs=%d", *downloads, *handoffs)
	}
}

func TestNorthwingManifestRejectsRollback(t *testing.T) {
	if err := rejectNorthwingManifestRollback("0.3.0", &NorthwingUpdateManifest{Version: "0.2.0"}); err == nil {
		t.Fatal("signed rollback manifest was accepted")
	}
	if err := rejectNorthwingManifestRollback("0.3.0", &NorthwingUpdateManifest{Version: "0.3.0"}); err != nil {
		t.Fatalf("current manifest rejected: %v", err)
	}
}

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
	evaluateNorthwingReleaseForPlatform(info, northwingGitHubRelease{
		TagName: "northwing-v0.2.0",
		HTMLURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/tag/northwing-v0.2.0",
		Body:    "Release notes",
		Assets: []northwingGitHubAsset{
			{Name: "Northwing-0.2.0-windows-x64-setup.exe", BrowserDownloadURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v0.2.0/Northwing-0.2.0-windows-x64-setup.exe", Size: 42},
			{Name: "Northwing-0.2.0-SHA256SUMS.txt", BrowserDownloadURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v0.2.0/Northwing-0.2.0-SHA256SUMS.txt", Size: 128},
		},
	}, "windows", "amd64")
	if !info.Available || !info.CanSelfUpdate || info.ManualOnly || info.InstallMode != "installer" || info.AssetSize != 42 {
		t.Fatalf("info = %+v", info)
	}
}

func TestNorthwingReleaseRejectsForeignAssetHost(t *testing.T) {
	info := newNorthwingUpdateInfo("0.1.0")
	evaluateNorthwingReleaseForPlatform(info, northwingGitHubRelease{
		TagName: "northwing-v0.2.0",
		HTMLURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/tag/northwing-v0.2.0",
		Assets: []northwingGitHubAsset{
			{Name: "Northwing-0.2.0-windows-x64-setup.exe", BrowserDownloadURL: "https://evil.invalid/Northwing-0.2.0-windows-x64-setup.exe", Size: 42},
		},
	}, "windows", "amd64")
	if info.CanSelfUpdate {
		t.Fatalf("foreign asset was accepted: %+v", info)
	}
}

func TestParseNorthwingChecksumSelectsExactInstaller(t *testing.T) {
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	data := []byte(hash + "  Northwing-0.2.0-windows-x64-portable.zip\n" + hash + "  Northwing-0.2.0-windows-x64-setup.exe\n")
	got, err := parseNorthwingChecksum(data, "Northwing-0.2.0-windows-x64-setup.exe")
	if err != nil || got != hash {
		t.Fatalf("got %q, err %v", got, err)
	}
}

func TestEvaluateNorthwingReleaseKeepsOtherPlatformsManual(t *testing.T) {
	info := newNorthwingUpdateInfo("0.1.0")
	evaluateNorthwingReleaseForPlatform(info, northwingGitHubRelease{
		TagName: "northwing-v0.2.0",
		Assets: []northwingGitHubAsset{
			{Name: "Northwing-0.2.0-windows-x64-setup.exe", BrowserDownloadURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v0.2.0/Northwing-0.2.0-windows-x64-setup.exe", Size: 42},
			{Name: "Northwing-0.2.0-SHA256SUMS.txt", BrowserDownloadURL: "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/download/northwing-v0.2.0/Northwing-0.2.0-SHA256SUMS.txt", Size: 128},
		},
	}, "linux", "amd64")
	if !info.Available || info.CanSelfUpdate || !info.ManualOnly {
		t.Fatalf("info = %+v", info)
	}
}
