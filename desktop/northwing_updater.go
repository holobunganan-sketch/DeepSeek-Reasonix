package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/mod/semver"

	"reasonix/internal/config"
	"reasonix/internal/northwing"
	"reasonix/internal/netclient"
)

const (
	northwingRepository        = northwing.ReleaseRepository
	northwingLatestReleaseAPI  = northwing.LatestReleaseAPIURL
	northwingReleasesPage      = northwing.ReleasePageURL
	maxNorthwingReleaseJSON    = int64(1 << 20)
	maxNorthwingChecksumSize   = int64(1 << 20)
	maxNorthwingInstallerSize  = int64(1 << 30)
	northwingReleaseCheckLimit = 10 * time.Second
	northwingDownloadLimit     = 10 * time.Minute
)

var (
	northwingTagRE       = regexp.MustCompile(`^northwing-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$`)
	northwingRequestIDRE = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
	northwingSHA256RE    = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

type northwingGitHubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

type northwingGitHubRelease struct {
	TagName    string                 `json:"tag_name"`
	HTMLURL    string                 `json:"html_url"`
	Body       string                 `json:"body"`
	Draft      bool                   `json:"draft"`
	Prerelease bool                   `json:"prerelease"`
	Assets     []northwingGitHubAsset `json:"assets"`
}

type northwingReleaseSelection struct {
	Version  string
	Tag      string
	Setup    northwingGitHubAsset
	Checksum northwingGitHubAsset
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

func northwingVersionFromTag(tag string) (string, bool) {
	tag = strings.TrimSpace(tag)
	if !northwingTagRE.MatchString(tag) {
		return "", false
	}
	return strings.TrimPrefix(tag, "northwing-"), true
}

func trustedNorthwingReleaseURL(rawURL, tag string) bool {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Scheme != "https" || !strings.EqualFold(u.Hostname(), "github.com") || u.Port() != "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	return u.EscapedPath() == "/"+northwing.ReleaseRepository+"/releases/tag/"+tag
}

func trustedNorthwingAssetURL(rawURL, tag, filename string) bool {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Scheme != "https" || !strings.EqualFold(u.Hostname(), "github.com") || u.Port() != "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	return u.EscapedPath() == "/"+northwing.ReleaseRepository+"/releases/download/"+tag+"/"+filename
}

func northwingAssetNames(version, goos, goarch string) (setup, checksum string, ok bool) {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	if goos != "windows" || goarch != "amd64" || version == "" {
		return "", "", false
	}
	return "Northwing-" + version + "-windows-x64-setup.exe", "Northwing-" + version + "-SHA256SUMS.txt", true
}

func selectNorthwingReleaseAssets(release northwingGitHubRelease, goos, goarch string) (northwingReleaseSelection, bool) {
	latest, ok := northwingVersionFromTag(release.TagName)
	if !ok || release.Draft || release.Prerelease {
		return northwingReleaseSelection{}, false
	}
	setupName, checksumName, ok := northwingAssetNames(latest, goos, goarch)
	if !ok {
		return northwingReleaseSelection{}, false
	}
	selection := northwingReleaseSelection{Version: latest, Tag: release.TagName}
	for _, asset := range release.Assets {
		switch asset.Name {
		case setupName:
			if asset.Size <= 0 || asset.Size > maxNorthwingInstallerSize || !trustedNorthwingAssetURL(asset.BrowserDownloadURL, release.TagName, setupName) {
				return northwingReleaseSelection{}, false
			}
			selection.Setup = asset
		case checksumName:
			if asset.Size <= 0 || asset.Size > maxNorthwingChecksumSize || !trustedNorthwingAssetURL(asset.BrowserDownloadURL, release.TagName, checksumName) {
				return northwingReleaseSelection{}, false
			}
			selection.Checksum = asset
		}
	}
	if selection.Setup.Name == "" || selection.Checksum.Name == "" {
		return northwingReleaseSelection{}, false
	}
	return selection, true
}

func normalizeNorthwingVersion(v string) string {
	v = strings.TrimSpace(v)
	if v != "" && !strings.HasPrefix(v, "v") {
		v = "v" + v
	}
	return v
}

func evaluateNorthwingReleaseForPlatform(info *UpdateInfo, release northwingGitHubRelease, goos, goarch string) {
	if info == nil || release.Draft || release.Prerelease {
		return
	}
	latest, ok := northwingVersionFromTag(release.TagName)
	if !ok {
		return
	}
	info.Latest = latest
	info.Notes = release.Body
	if trustedNorthwingReleaseURL(release.HTMLURL, release.TagName) {
		info.DownloadURL = release.HTMLURL
	}
	current := normalizeNorthwingVersion(info.Current)
	info.Available = semver.IsValid(current) && semver.IsValid(latest) && semver.Compare(latest, current) > 0
	if !info.Available {
		return
	}
	selection, ok := selectNorthwingReleaseAssets(release, goos, goarch)
	if !ok {
		return
	}
	info.CanSelfUpdate = true
	info.ManualOnly = false
	info.ManualReason = ""
	info.InstallMode = "installer"
	info.AssetSize = selection.Setup.Size
}

func evaluateNorthwingRelease(info *UpdateInfo, release northwingGitHubRelease) {
	evaluateNorthwingReleaseForPlatform(info, release, runtime.GOOS, runtime.GOARCH)
}

func validateNorthwingRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 10 {
		return errors.New("northwing update: stopped after 10 redirects")
	}
	if req == nil || req.URL == nil || req.URL.Scheme != "https" || req.URL.Hostname() == "" || req.URL.User != nil || req.URL.Port() != "" {
		return errors.New("northwing update: refused invalid redirect")
	}
	host := strings.ToLower(strings.TrimSuffix(req.URL.Hostname(), "."))
	if host == "api.github.com" || host == "github.com" || strings.HasSuffix(host, ".githubusercontent.com") {
		return nil
	}
	return fmt.Errorf("northwing update: refused redirect to untrusted host %q", req.URL.Host)
}

func newNorthwingHTTPClient(forceIPv4 bool) (*http.Client, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}
	client, err := netclient.NewHTTPClient(cfg.NetworkProxySpec(), netclient.TransportOptions{ForceIPv4: forceIPv4})
	if err != nil {
		return nil, err
	}
	client.CheckRedirect = validateNorthwingRedirect
	return client, nil
}

func fetchNorthwingRelease(ctx context.Context, client *http.Client) (northwingGitHubRelease, error) {
	var release northwingGitHubRelease
	if client == nil {
		return release, errors.New("northwing update: missing HTTP client")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, northwingLatestReleaseAPI, nil)
	if err != nil {
		return release, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", fmt.Sprintf("Northwing-Updater/%s (%s/%s)", version, runtime.GOOS, runtime.GOARCH))
	resp, err := client.Do(req)
	if err != nil {
		return release, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return release, nil
	}
	if resp.StatusCode != http.StatusOK {
		return release, fmt.Errorf("northwing release check returned HTTP %d", resp.StatusCode)
	}
	decoder := json.NewDecoder(io.LimitReader(resp.Body, maxNorthwingReleaseJSON+1))
	if err := decoder.Decode(&release); err != nil {
		return release, fmt.Errorf("decode Northwing release: %w", err)
	}
	return release, nil
}

func fetchNorthwingAssetBytes(ctx context.Context, client *http.Client, asset northwingGitHubAsset, maxSize int64) ([]byte, error) {
	if asset.Size <= 0 || asset.Size > maxSize {
		return nil, fmt.Errorf("northwing update: invalid asset size %d for %s", asset.Size, asset.Name)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.BrowserDownloadURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/octet-stream")
	req.Header.Set("User-Agent", fmt.Sprintf("Northwing-Updater/%s", version))
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("northwing update: download %s returned HTTP %d", asset.Name, resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxSize+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxSize || int64(len(data)) != asset.Size {
		return nil, fmt.Errorf("northwing update: downloaded size %d does not match %d for %s", len(data), asset.Size, asset.Name)
	}
	return data, nil
}

func parseNorthwingChecksum(data []byte, filename string) (string, error) {
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	scanner.Buffer(make([]byte, 1024), int(maxNorthwingChecksumSize))
	found := ""
	for scanner.Scan() {
		line := strings.TrimSuffix(scanner.Text(), "\r")
		parts := strings.SplitN(line, "  ", 2)
		if len(parts) != 2 || parts[1] != filename {
			continue
		}
		hash := strings.ToLower(parts[0])
		if !northwingSHA256RE.MatchString(hash) {
			return "", fmt.Errorf("northwing update: invalid SHA-256 for %s", filename)
		}
		if found != "" {
			return "", fmt.Errorf("northwing update: duplicate checksum for %s", filename)
		}
		found = hash
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	if found == "" {
		return "", fmt.Errorf("northwing update: checksum is missing for %s", filename)
	}
	return found, nil
}

func downloadNorthwingInstaller(ctx context.Context, client *http.Client, asset northwingGitHubAsset, expectedHash, destination string, progress func(received, total int64)) error {
	if asset.Size <= 0 || asset.Size > maxNorthwingInstallerSize || !northwingSHA256RE.MatchString(expectedHash) {
		return errors.New("northwing update: invalid installer metadata")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.BrowserDownloadURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/octet-stream")
	req.Header.Set("User-Agent", fmt.Sprintf("Northwing-Updater/%s", version))
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("northwing update: installer download returned HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > 0 && resp.ContentLength != asset.Size {
		return fmt.Errorf("northwing update: installer response size %d does not match %d", resp.ContentLength, asset.Size)
	}
	file, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	keep := false
	defer func() {
		_ = file.Close()
		if !keep {
			_ = os.Remove(destination)
		}
	}()

	hasher := sha256.New()
	writer := io.MultiWriter(file, hasher)
	buffer := make([]byte, 128*1024)
	var received int64
	for {
		n, readErr := resp.Body.Read(buffer)
		if n > 0 {
			received += int64(n)
			if received > asset.Size || received > maxNorthwingInstallerSize {
				return errors.New("northwing update: installer exceeded declared size")
			}
			if _, err := writer.Write(buffer[:n]); err != nil {
				return err
			}
			if progress != nil {
				progress(received, asset.Size)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	if received != asset.Size {
		return fmt.Errorf("northwing update: installer size %d does not match %d", received, asset.Size)
	}
	actualHash := hex.EncodeToString(hasher.Sum(nil))
	if actualHash != expectedHash {
		return fmt.Errorf("northwing update: SHA-256 mismatch for %s", asset.Name)
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	keep = true
	return nil
}

func copyNorthwingUpdateHelper(destination string) error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("northwing update: resolve executable: %w", err)
	}
	source := filepath.Join(filepath.Dir(executable), "northwing-update-helper.exe")
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("northwing update: inspect helper: %w", err)
	}
	if !info.Mode().IsRegular() || info.Size() <= 0 || info.Size() > 64<<20 {
		return fmt.Errorf("northwing update: invalid helper size %d", info.Size())
	}
	input, err := os.Open(source)
	if err != nil {
		return fmt.Errorf("northwing update: open helper: %w", err)
	}
	defer input.Close()
	output, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o700)
	if err != nil {
		return err
	}
	ok := false
	defer func() {
		_ = output.Close()
		if !ok {
			_ = os.Remove(destination)
		}
	}()
	written, err := io.Copy(output, input)
	if err != nil {
		return err
	}
	if written != info.Size() {
		return fmt.Errorf("northwing update: copied helper size %d does not match %d", written, info.Size())
	}
	if err := output.Sync(); err != nil {
		return err
	}
	if err := output.Close(); err != nil {
		return err
	}
	ok = true
	return nil
}

func validateNorthwingUpdateRequest(expectedVersion, requestID string) (string, string, error) {
	requestID = strings.TrimSpace(requestID)
	if !northwingRequestIDRE.MatchString(requestID) {
		return "", "", errors.New("northwing update: invalid request id")
	}
	expectedVersion = normalizeNorthwingVersion(expectedVersion)
	if !semver.IsValid(expectedVersion) || !northwingTagRE.MatchString("northwing-"+expectedVersion) || strings.Contains(expectedVersion, "-") {
		return "", "", fmt.Errorf("northwing update: invalid stable version %q", expectedVersion)
	}
	return expectedVersion, requestID, nil
}

func (a *App) northwingUpdateError(requestID, expectedVersion string, err error) error {
	if err == nil {
		return nil
	}
	a.emitProgress(requestID, "stable", expectedVersion, "error", 0, 0, err.Error())
	return err
}

// CheckNorthwingUpdate queries only Northwing's tag namespace and package names.
// It never reads Reasonix update manifests, channels, signatures, or download
// endpoints, so an upstream release cannot replace the Northwing application.
func (a *App) CheckNorthwingUpdate() (*UpdateInfo, error) {
	info := newNorthwingUpdateInfo(version)
	client, err := newNorthwingHTTPClient(false)
	if err != nil {
		info.Err = err.Error()
		return info, nil
	}
	ctx, cancel := context.WithTimeout(a.reqCtx(), northwingReleaseCheckLimit)
	defer cancel()
	release, err := fetchNorthwingRelease(ctx, client)
	if err != nil {
		info.Err = err.Error()
		return info, nil
	}
	evaluateNorthwingRelease(info, release)
	return info, nil
}

// ApplyNorthwingUpdateRequest downloads the exact stable installer selected by
// CheckNorthwingUpdate, verifies it against Northwing's release checksum file,
// and hands replacement to the Windows-only Northwing helper.
func (a *App) ApplyNorthwingUpdateRequest(expectedVersion, requestID string) error {
	expectedVersion, requestID, err := validateNorthwingUpdateRequest(expectedVersion, requestID)
	if err != nil {
		return err
	}
	finish, err := a.beginUpdaterOperation(requestID)
	if err != nil {
		return err
	}
	defer finish()

	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
		return a.northwingUpdateError(requestID, expectedVersion, errors.New("northwing update: automatic replacement is currently available only for Windows x64"))
	}
	client, err := newNorthwingHTTPClient(false)
	if err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	ctx, cancel := context.WithTimeout(a.reqCtx(), northwingDownloadLimit)
	defer cancel()
	release, err := fetchNorthwingRelease(ctx, client)
	if err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	selection, ok := selectNorthwingReleaseAssets(release, runtime.GOOS, runtime.GOARCH)
	if !ok {
		return a.northwingUpdateError(requestID, expectedVersion, errors.New("northwing update: the latest release has no verified Windows x64 installer"))
	}
	if selection.Version != expectedVersion {
		return a.northwingUpdateError(requestID, expectedVersion, fmt.Errorf("northwing update: latest release changed from %s to %s; check again", expectedVersion, selection.Version))
	}

	checksumBytes, err := fetchNorthwingAssetBytes(ctx, client, selection.Checksum, maxNorthwingChecksumSize)
	if err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	expectedHash, err := parseNorthwingChecksum(checksumBytes, selection.Setup.Name)
	if err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	stagingDir, err := os.MkdirTemp("", "northwing-update-"+strings.TrimPrefix(expectedVersion, "v")+"-")
	if err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.RemoveAll(stagingDir)
		}
	}()
	installerPath := filepath.Join(stagingDir, selection.Setup.Name)
	a.emitProgress(requestID, "stable", expectedVersion, "downloading", 0, selection.Setup.Size, "")
	if err := downloadNorthwingInstaller(ctx, client, selection.Setup, expectedHash, installerPath, func(received, total int64) {
		a.emitProgress(requestID, "stable", expectedVersion, "downloading", received, total, "")
	}); err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	a.emitProgress(requestID, "stable", expectedVersion, "verifying", selection.Setup.Size, selection.Setup.Size, "")
	helperPath := filepath.Join(stagingDir, "northwing-update-helper.exe")
	if err := copyNorthwingUpdateHelper(helperPath); err != nil {
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	a.emitProgress(requestID, "stable", expectedVersion, "downloaded", selection.Setup.Size, selection.Setup.Size, "")
	cleanup = false
	if err := a.handoffNorthwingUpdate(requestID, expectedVersion, installerPath, helperPath, stagingDir, selection.Setup.Size); err != nil {
		cleanup = true
		return a.northwingUpdateError(requestID, expectedVersion, err)
	}
	return nil
}

func (a *App) OpenNorthwingDownloadPage() {
	if a.ctx != nil {
		wruntime.BrowserOpenURL(a.ctx, northwingReleasesPage)
	}
}
