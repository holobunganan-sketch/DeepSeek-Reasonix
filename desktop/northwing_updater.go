package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/mod/semver"
)

const (
	northwingLatestReleaseAPI = "https://api.github.com/repos/holobunganan-sketch/DeepSeek-Reasonix/releases/latest"
	northwingReleasesPage     = "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases"
)

var northwingTagRE = regexp.MustCompile(`^northwing-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$`)

type northwingGitHubRelease struct {
	TagName    string `json:"tag_name"`
	HTMLURL    string `json:"html_url"`
	Body       string `json:"body"`
	Draft      bool   `json:"draft"`
	Prerelease bool   `json:"prerelease"`
}

func newNorthwingUpdateInfo(current string) *UpdateInfo {
	return &UpdateInfo{
		Current:       current,
		Channel:       "stable",
		CanSelfUpdate: false,
		ManualOnly:    true,
		ManualReason:  "Install Northwing updates from the official Northwing release page.",
		InstallMode:   "manual",
		DownloadURL:   northwingReleasesPage,
	}
}

func evaluateNorthwingRelease(info *UpdateInfo, release northwingGitHubRelease) {
	if info == nil || release.Draft || release.Prerelease || !northwingTagRE.MatchString(release.TagName) {
		return
	}
	latest := strings.TrimPrefix(release.TagName, "northwing-")
	current := strings.TrimSpace(info.Current)
	if !strings.HasPrefix(current, "v") {
		current = "v" + current
	}
	info.Latest = latest
	info.Notes = release.Body
	if strings.HasPrefix(release.HTMLURL, "https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases/") {
		info.DownloadURL = release.HTMLURL
	}
	info.Available = semver.IsValid(current) && semver.IsValid(latest) && semver.Compare(latest, current) > 0
}

// CheckNorthwingUpdate queries only the Northwing fork's Release endpoint. The
// initial product line is manual-update-only until Northwing has its own signed
// manifest and signing keys; this prevents the inherited Reasonix updater from
// ever installing an upstream binary over Northwing.
func (a *App) CheckNorthwingUpdate() (*UpdateInfo, error) {
	info := newNorthwingUpdateInfo(version)
	client, err := httpClient()
	if err != nil {
		info.Err = err.Error()
		return info, nil
	}
	ctx, cancel := context.WithTimeout(a.reqCtx(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, northwingLatestReleaseAPI, nil)
	if err != nil {
		info.Err = err.Error()
		return info, nil
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", fmt.Sprintf("Northwing-Updater/%s", version))
	resp, err := client.Do(req)
	if err != nil {
		info.Err = err.Error()
		return info, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return info, nil
	}
	if resp.StatusCode != http.StatusOK {
		info.Err = fmt.Sprintf("Northwing release check returned HTTP %d", resp.StatusCode)
		return info, nil
	}
	var release northwingGitHubRelease
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&release); err != nil {
		info.Err = fmt.Sprintf("decode Northwing release: %v", err)
		return info, nil
	}
	evaluateNorthwingRelease(info, release)
	return info, nil
}

func (a *App) OpenNorthwingDownloadPage() {
	if a.ctx != nil {
		wruntime.BrowserOpenURL(a.ctx, northwingReleasesPage)
	}
}
