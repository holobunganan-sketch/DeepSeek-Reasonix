// Command northwing exposes the complete Reasonix CLI through Northwing's
// independent runtime identity. The original reasonix command remains intact.
package main

import (
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"

	"reasonix/internal/cli"
	"reasonix/internal/config"
	"reasonix/internal/crashreport"

	_ "reasonix/internal/provider/anthropic"
	_ "reasonix/internal/provider/openai"
	_ "reasonix/internal/provider/responses"
	_ "reasonix/internal/tool/builtin"
)

var version = "dev"
var runCLI = cli.Run

func main() {
	applyNorthwingCLIIdentity()
	os.Exit(runWithCrashCapture(os.Args[1:], version))
}

func runWithCrashCapture(args []string, buildVersion string) (exitCode int) {
	defer func() {
		if recovered := recover(); recovered != nil {
			_ = crashreport.CapturePanic(config.ReasonixHomeDir(), buildVersion, recovered, debug.Stack())
			panic(recovered)
		}
	}()
	return runCLI(args, buildVersion)
}

func applyNorthwingCLIIdentity() {
	if strings.TrimSpace(os.Getenv("REASONIX_HOME")) != "" {
		return
	}
	home := strings.TrimSpace(os.Getenv("NORTHWING_HOME"))
	if home == "" {
		if runtime.GOOS == "windows" {
			if dir, err := os.UserConfigDir(); err == nil && dir != "" {
				home = filepath.Join(dir, "Northwing")
			}
		} else if dir, err := os.UserHomeDir(); err == nil && dir != "" {
			home = filepath.Join(dir, ".northwing")
		}
	}
	if home == "" {
		return
	}
	_ = os.Setenv("REASONIX_HOME", home)
	_ = os.Setenv("REASONIX_STATE_HOME", home)
	cache := strings.TrimSpace(os.Getenv("NORTHWING_CACHE_HOME"))
	if cache == "" {
		if dir, err := os.UserCacheDir(); err == nil && dir != "" {
			cache = filepath.Join(dir, "Northwing")
		} else {
			cache = filepath.Join(home, "cache")
		}
	}
	_ = os.Setenv("REASONIX_CACHE_HOME", cache)
}
