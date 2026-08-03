package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestNorthwingIdentityConstants(t *testing.T) {
	if northwingProductName != "Northwing" {
		t.Fatalf("product = %q", northwingProductName)
	}
	if northwingProtocol != "northwing" {
		t.Fatalf("protocol = %q", northwingProtocol)
	}
	if northwingAppID != "io.github.holobunganansketch.northwing" {
		t.Fatalf("app id = %q", northwingAppID)
	}
}

func TestDefaultNorthwingCacheIsProductScoped(t *testing.T) {
	cache := defaultNorthwingCache(filepath.Join(t.TempDir(), "home"))
	if cache == "" || !strings.Contains(strings.ToLower(filepath.ToSlash(cache)), "northwing") {
		t.Fatalf("cache = %q", cache)
	}
}
