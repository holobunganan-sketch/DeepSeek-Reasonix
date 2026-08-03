// Command northwing is the Wails shell around the complete Reasonix kernel: a
// native window hosting a webview frontend, with the Go-side controller bound
// directly to the UI (no HTTP hop — bindings in, runtime events out).
package main

import (
	"context"
	"embed"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	// Blank imports wire compile-time built-ins into their registries, exactly as
	// cmd/reasonix does — boot.Build resolves providers/tools from these registries.
	_ "reasonix/internal/provider/anthropic"
	_ "reasonix/internal/provider/openai"
	_ "reasonix/internal/provider/responses"
	"reasonix/internal/repair"
	_ "reasonix/internal/tool/builtin"
)

// assets embeds the built frontend. `all:` so dotfiles are included. A real run
// requires `pnpm build` (or `wails build`) to populate dist.
//
//go:embed all:frontend/dist
var assets embed.FS

// version is injected at build time via `wails build -ldflags "-X main.version=..."`.
var version = "dev"

// channel records the build's release line. Default stable tracks Northwing
// releases; preview tracks opt-in test builds.
var channel = "stable"

// macSelfUpdate is injected as true only for signed + notarized macOS builds.
var macSelfUpdate = "false"

const (
	disableWebview2GPUEnv       = "NORTHWING_DESKTOP_DISABLE_WEBVIEW2_GPU"
	legacyDisableWebview2GPUEnv = "REASONIX_DESKTOP_DISABLE_WEBVIEW2_GPU"
	linuxDRIRenderNodeGlob      = "/dev/dri/renderD*"
)

func macSelfUpdateAllowed() bool {
	switch strings.ToLower(strings.TrimSpace(macSelfUpdate)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func windowsWebview2GPUDisabled() bool {
	for _, name := range []string{disableWebview2GPUEnv, legacyDisableWebview2GPUEnv} {
		if raw, ok := os.LookupEnv(name); ok {
			switch strings.ToLower(strings.TrimSpace(raw)) {
			case "1", "true", "yes", "on":
				return true
			case "0", "false", "no", "off", "":
				return false
			}
		}
	}
	return channel == "preview" || channel == "canary"
}

func linuxWebviewGpuPolicy(pattern string) linux.WebviewGpuPolicy {
	matches, err := filepath.Glob(pattern)
	if err == nil {
		for _, path := range matches {
			f, err := os.OpenFile(path, os.O_RDWR, 0)
			if err == nil {
				_ = f.Close()
				return linux.WebviewGpuPolicyOnDemand
			}
		}
	}
	return linux.WebviewGpuPolicyNever
}

func main() {
	// OpenSSH launches the Desktop executable itself as the short-lived
	// SSH_ASKPASS helper. Handle that one-time capability before Wails or CLI.
	if handled, exitCode := RunRemoteAskPassHelper(context.Background(), os.Args[1:], os.Getenv, os.Stdout); handled {
		os.Exit(exitCode)
	}
	if handled, exitCode := maybeRunMacUpdateHandoff(os.Args[1:]); handled {
		os.Exit(exitCode)
	}
	if handled, exitCode := maybeRunNorthwingCLI(os.Args[1:]); handled {
		os.Exit(exitCode)
	}
	capturePreviousFatalCrash()
	installFatalCrashOutput()

	// Accept and strip legacy launch tokens from old shortcuts.
	_ = parseDesktopLaunchArgs(os.Args[1:])

	previousRun := repair.NewStartupTracker("").ObservePreviousRun()
	app := NewApp()
	app.previousRun = previousRun
	singleInstance := singleInstanceLock(app)
	appMenu := app.createAppMenu()
	dragAndDrop := &options.DragAndDrop{EnableFileDrop: true}
	bindings := []any{app}

	width, height := 1240, 720
	if saved, ok := loadWindowState(); ok {
		if saved.Width > 0 {
			width = saved.Width
		}
		if saved.Height > 0 {
			height = saved.Height
		}
	}

	zoomFactor := 1.0
	if zf, ok := loadZoomFactor(); ok && zf > 0 {
		zoomFactor = zf
	}

	scheduleWebKitSignalHandlerRepair()

	err := wails.Run(&options.App{
		Title:     northwingProductName,
		Width:     width,
		Height:    height,
		Frameless: goruntime.GOOS == "windows",
		Logger:    newCrashCaptureLogger(app),
		MinWidth:  760,
		MinHeight: 480,
		BackgroundColour: &options.RGBA{R: 26, G: 26, B: 46, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
			Middleware: assetserver.ChainMiddleware(
				app.jsProfilingMiddleware(),
				app.remoteMarkdownImageMiddleware(),
				app.workspaceMediaMiddleware(),
				app.themeAssetMiddleware(),
			),
		},
		OnStartup:          app.startup,
		OnDomReady:         app.domReady,
		OnBeforeClose:      app.beforeClose,
		OnShutdown:         app.shutdown,
		Bind:               bindings,
		SingleInstanceLock: singleInstance,
		StartHidden:        true,
		Menu:               appMenu,
		DragAndDrop:        dragAndDrop,

		Mac: &mac.Options{
			TitleBar:  mac.TitleBarHiddenInset(),
			Appearance: mac.DefaultAppearance,
		},
		Windows: &windows.Options{
			Theme:                windows.SystemDefault,
			ZoomFactor:           zoomFactor,
			WebviewGpuIsDisabled: windowsWebview2GPUDisabled(),
		},
		Linux: &linux.Options{
			ProgramName:      northwingProductName,
			WebviewGpuPolicy: linuxWebviewGpuPolicy(linuxDRIRenderNodeGlob),
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}

// desktopLaunchOptions captures legacy argv that old installers/shortcuts may
// still pass. Fields are accepted and ignored so migration never crashes.
type desktopLaunchOptions struct {
	LegacySafeModeArg bool
}

func parseDesktopLaunchArgs(args []string) desktopLaunchOptions {
	var out desktopLaunchOptions
	for _, arg := range args {
		switch arg {
		case "--safe-mode", "-safe-mode", "launch", "--detach":
			if arg == "--safe-mode" || arg == "-safe-mode" {
				out.LegacySafeModeArg = true
			}
		}
	}
	return out
}
