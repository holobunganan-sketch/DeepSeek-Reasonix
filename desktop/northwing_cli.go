package main

import (
	"fmt"
	"os"
	"strings"

	"reasonix/internal/cli"
)

var runNorthwingCLI = cli.Run

// maybeRunNorthwingCLI lets the packaged desktop executable serve as the
// `northwing` CLI without creating a second product identity. Protocol URLs,
// old desktop launch tokens, and macOS process-serial arguments stay on the
// Wails path; all other arguments use the complete Reasonix CLI implementation.
func maybeRunNorthwingCLI(args []string) (bool, int) {
	if !northwingCLIRequested(args) {
		return false, 0
	}
	first := strings.ToLower(strings.TrimSpace(args[0]))
	switch first {
	case "version", "--version", "-v":
		fmt.Fprintln(os.Stdout, "northwing", version)
		return true, 0
	case "update", "upgrade":
		fmt.Fprintln(os.Stdout, "Northwing updates are distributed from:")
		fmt.Fprintln(os.Stdout, northwingReleasesPage)
		return true, 0
	case "help", "--help", "-h":
		printNorthwingCLIHelp()
		return true, 0
	default:
		_ = os.Setenv("REASONIX_CLI_NAME", "northwing")
		return true, runNorthwingCLI(args, version)
	}
}

func northwingCLIRequested(args []string) bool {
	if len(args) == 0 {
		return false
	}
	first := strings.TrimSpace(args[0])
	if first == "" {
		return false
	}
	if _, ok := parseNorthwingLaunch(first); ok {
		return false
	}
	if strings.HasPrefix(first, "-psn_") {
		return false
	}
	switch first {
	case "--safe-mode", "-safe-mode", "launch", "--detach":
		return false
	default:
		return true
	}
}

func printNorthwingCLIHelp() {
	fmt.Fprintln(os.Stdout, `Northwing — From intent to finished work.

Usage:
  northwing                         Open the desktop workspace
  northwing run [flags] <task>      Run a one-shot task
  northwing chat [flags]            Start an interactive session
  northwing serve [flags]           Start the Reasonix-compatible server
  northwing setup                   Configure providers and models
  northwing config ...              Read or update configuration
  northwing mcp ...                 Manage MCP servers
  northwing plugin ...              Manage plugins
  northwing remote ...              Use remote workspaces
  northwing doctor ...              Diagnose the installation
  northwing version                 Print the Northwing version
  northwing update                  Show the Northwing release page

All advanced Reasonix kernel commands remain available through this CLI.`)
}
