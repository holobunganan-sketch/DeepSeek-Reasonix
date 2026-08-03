package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	northwingProductName = "Northwing"
	northwingProtocol    = "northwing"
	northwingAppID       = "io.github.holobunganansketch.northwing"
)

func init() {
	applyNorthwingRuntimeIdentity()
}

// applyNorthwingRuntimeIdentity redirects the unchanged Reasonix kernel to
// Northwing-owned data paths. Existing Reasonix installs and explicit isolation
// variables are preserved; Northwing never writes into them by default.
func applyNorthwingRuntimeIdentity() {
	if explicitRuntimeHome() {
		return
	}
	home := strings.TrimSpace(os.Getenv("NORTHWING_HOME"))
	state := strings.TrimSpace(os.Getenv("NORTHWING_STATE_HOME"))
	cache := strings.TrimSpace(os.Getenv("NORTHWING_CACHE_HOME"))
	if home == "" {
		home = defaultNorthwingHome()
	}
	if state == "" {
		state = home
	}
	if cache == "" {
		cache = defaultNorthwingCache(home)
	}
	setEnvIfEmpty("REASONIX_HOME", home)
	setEnvIfEmpty("REASONIX_STATE_HOME", state)
	setEnvIfEmpty("REASONIX_CACHE_HOME", cache)
}

func explicitRuntimeHome() bool {
	return strings.TrimSpace(os.Getenv("REASONIX_HOME")) != "" ||
		strings.TrimSpace(os.Getenv("REASONIX_STATE_HOME")) != "" ||
		strings.TrimSpace(os.Getenv("REASONIX_CACHE_HOME")) != ""
}

func setEnvIfEmpty(name, value string) {
	if strings.TrimSpace(value) == "" || strings.TrimSpace(os.Getenv(name)) != "" {
		return
	}
	_ = os.Setenv(name, filepath.Clean(value))
}

func defaultNorthwingHome() string {
	if runtime.GOOS == "windows" {
		if dir, err := os.UserConfigDir(); err == nil && dir != "" {
			return filepath.Join(dir, northwingProductName)
		}
		if home, err := os.UserHomeDir(); err == nil && home != "" {
			return filepath.Join(home, "AppData", "Roaming", northwingProductName)
		}
		return ""
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".northwing")
	}
	if dir, err := os.UserConfigDir(); err == nil && dir != "" {
		return filepath.Join(dir, "northwing")
	}
	return ""
}

func defaultNorthwingCache(home string) string {
	if dir, err := os.UserCacheDir(); err == nil && dir != "" {
		return filepath.Join(dir, northwingProductName)
	}
	if home == "" {
		return ""
	}
	return filepath.Join(home, "cache")
}
