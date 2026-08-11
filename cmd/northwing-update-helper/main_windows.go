//go:build windows

package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
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

func validateCleanupTarget(path, currentExecutable string) (string, string, error) {
	staging, err := filepath.Abs(strings.TrimSpace(path))
	if err != nil {
		return "", "", fmt.Errorf("resolve cleanup directory: %w", err)
	}
	staging, err = filepath.EvalSymlinks(staging)
	if err != nil {
		return "", "", fmt.Errorf("resolve cleanup directory links: %w", err)
	}
	info, err := os.Stat(staging)
	if err != nil {
		return "", "", fmt.Errorf("inspect cleanup directory: %w", err)
	}
	if !info.IsDir() {
		return "", "", errors.New("cleanup target is not a directory")
	}

	executable, err := filepath.Abs(currentExecutable)
	if err != nil {
		return "", "", fmt.Errorf("resolve update helper path: %w", err)
	}
	executable, err = filepath.EvalSymlinks(executable)
	if err != nil {
		return "", "", fmt.Errorf("resolve update helper links: %w", err)
	}
	if !strings.EqualFold(filepath.Dir(executable), staging) {
		return "", "", errors.New("cleanup target does not directly own the running update helper")
	}
	return staging, executable, nil
}

const cleanupDiagnosticName = "cleanup-error.log"

func writeCleanupDiagnostic(staging string, cleanupErr error) {
	if cleanupErr == nil {
		return
	}
	_ = os.WriteFile(filepath.Join(staging, cleanupDiagnosticName), []byte(cleanupErr.Error()+"\n"), 0o600)
}

func cleanupStagingAfterProcess(path, ownerExecutable string, pid int, wait func(int, time.Duration) error) (resultErr error) {
	staging, _, err := validateCleanupTarget(path, ownerExecutable)
	if err != nil {
		return err
	}
	defer func() {
		writeCleanupDiagnostic(staging, resultErr)
	}()
	if err := wait(pid, 2*time.Minute); err != nil {
		return fmt.Errorf("wait for update helper before cleanup: %w", err)
	}
	if err := os.RemoveAll(staging); err != nil {
		return fmt.Errorf("remove update staging directory: %w", err)
	}
	return nil
}

func startCleanupChild(installedHelper, staging, ownerExecutable string, pid int) error {
	info, err := os.Stat(installedHelper)
	if err != nil {
		return fmt.Errorf("inspect installed update helper: %w", err)
	}
	if !info.Mode().IsRegular() {
		return errors.New("installed update helper is not a regular file")
	}
	command := exec.Command(
		installedHelper,
		"--cleanup-after-pid", strconv.Itoa(pid),
		"--cleanup", staging,
		"--cleanup-owner", ownerExecutable,
	)
	if err := command.Start(); err != nil {
		return fmt.Errorf("start native cleanup helper: %w", err)
	}
	return nil
}

func run(args []string) error {
	flags := flag.NewFlagSet("northwing-update-helper", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	installer := flags.String("installer", "", "verified Northwing setup executable")
	pidText := flags.String("pid", "", "Northwing process id to wait for")
	restart := flags.String("restart", "", "installed Northwing executable to relaunch")
	expected := flags.String("expected-version", "", "expected installed version")
	cleanup := flags.String("cleanup", "", "staging directory to remove")
	cleanupAfterPID := flags.String("cleanup-after-pid", "", "update helper process id to wait for before cleanup")
	cleanupOwner := flags.String("cleanup-owner", "", "staged update helper that owns the cleanup directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*cleanupAfterPID) != "" {
		pid, err := strconv.Atoi(*cleanupAfterPID)
		if err != nil {
			return fmt.Errorf("invalid --cleanup-after-pid: %w", err)
		}
		if strings.TrimSpace(*cleanup) == "" || strings.TrimSpace(*cleanupOwner) == "" {
			return errors.New("--cleanup and --cleanup-owner are required in cleanup mode")
		}
		return cleanupStagingAfterProcess(*cleanup, *cleanupOwner, pid, waitForProcess)
	}

	pid, err := strconv.Atoi(*pidText)
	if err != nil {
		return fmt.Errorf("invalid --pid: %w", err)
	}
	if *installer == "" || *restart == "" || *expected == "" {
		return errors.New("--installer, --restart, and --expected-version are required")
	}
	currentExecutable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate running update helper: %w", err)
	}
	if strings.TrimSpace(*cleanup) != "" {
		if _, _, err := validateCleanupTarget(*cleanup, currentExecutable); err != nil {
			return err
		}
	}
	installerPath, err := filepath.Abs(*installer)
	if err != nil {
		return err
	}
	if err := waitForProcess(pid, 2*time.Minute); err != nil {
		return err
	}
	restartPath, err := filepath.Abs(*restart)
	if err != nil {
		return err
	}
	command := exec.Command(installerPath, "/S", "/NORTHWING_UPDATE=1", "/D="+filepath.Dir(restartPath))
	if output, err := command.CombinedOutput(); err != nil {
		return fmt.Errorf("Northwing installer failed: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	if err := validateInstalledVersion(restartPath, *expected); err != nil {
		return err
	}
	if strings.TrimSpace(*cleanup) != "" {
		installedHelper := filepath.Join(filepath.Dir(restartPath), "northwing-update-helper.exe")
		if err := startCleanupChild(installedHelper, *cleanup, currentExecutable, os.Getpid()); err != nil {
			return err
		}
	}
	if err := exec.Command(restartPath).Start(); err != nil {
		return fmt.Errorf("restart Northwing: %w", err)
	}
	return nil
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
