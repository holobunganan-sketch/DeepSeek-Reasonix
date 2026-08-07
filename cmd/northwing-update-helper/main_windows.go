//go:build windows

package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

func waitForProcess(pid int, timeout time.Duration) error {
	if pid <= 0 {
		return errors.New("invalid Northwing process id")
	}
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		if errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
			return nil
		}
		return fmt.Errorf("open Northwing process %d: %w", pid, err)
	}
	defer windows.CloseHandle(handle)
	milliseconds := uint32(timeout / time.Millisecond)
	result, err := windows.WaitForSingleObject(handle, milliseconds)
	if err != nil {
		return fmt.Errorf("wait for Northwing process %d: %w", pid, err)
	}
	if result == uint32(windows.WAIT_TIMEOUT) {
		return fmt.Errorf("Northwing process %d did not exit within %s", pid, timeout)
	}
	return nil
}

func validateInstalledVersion(executable, expected string) error {
	expected = strings.TrimPrefix(strings.TrimSpace(expected), "v")
	output, err := exec.Command(executable, "version").CombinedOutput()
	if err != nil {
		return fmt.Errorf("validate installed Northwing: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	if !strings.Contains(string(output), "northwing "+expected) {
		return fmt.Errorf("installed Northwing version mismatch: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func scheduleCleanup(path string) {
	path = strings.TrimSpace(path)
	if path == "" {
		return
	}
	// The helper is executing from the staging directory, so Windows cannot
	// remove it until this process exits. A detached shell removes the verified
	// installer and helper only after this process has released both files.
	command := fmt.Sprintf(`ping 127.0.0.1 -n 3 >nul & rmdir /S /Q "%s"`, strings.ReplaceAll(path, `"`, `""`))
	cleanup := exec.Command("cmd.exe", "/D", "/S", "/C", command)
	cleanup.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NEW_PROCESS_GROUP}
	_ = cleanup.Start()
}

func main() {
	installer := flag.String("installer", "", "verified Northwing setup executable")
	pidText := flag.String("pid", "", "Northwing process id to wait for")
	restart := flag.String("restart", "", "installed Northwing executable to relaunch")
	expected := flag.String("expected-version", "", "expected installed version")
	cleanup := flag.String("cleanup", "", "staging directory to remove")
	flag.Parse()

	pid, err := strconv.Atoi(*pidText)
	if err != nil {
		fmt.Fprintln(os.Stderr, "invalid --pid:", err)
		os.Exit(2)
	}
	if *installer == "" || *restart == "" || *expected == "" {
		fmt.Fprintln(os.Stderr, "--installer, --restart, and --expected-version are required")
		os.Exit(2)
	}
	installerPath, err := filepath.Abs(*installer)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if err := waitForProcess(pid, 2*time.Minute); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	restartPath, err := filepath.Abs(*restart)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	defer scheduleCleanup(*cleanup)
	command := exec.Command(installerPath, "/S", "/NORTHWING_UPDATE=1", "/D="+filepath.Dir(restartPath))
	if output, err := command.CombinedOutput(); err != nil {
		fmt.Fprintf(os.Stderr, "Northwing installer failed: %v\n%s\n", err, strings.TrimSpace(string(output)))
		os.Exit(1)
	}
	if err := validateInstalledVersion(restartPath, *expected); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := exec.Command(restartPath).Start(); err != nil {
		fmt.Fprintln(os.Stderr, "restart Northwing:", err)
		os.Exit(1)
	}
}
