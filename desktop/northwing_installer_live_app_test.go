//go:build windows

package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestNorthwingSilentUpdatePreservesLiveInstallation(t *testing.T) {
	makensis, err := exec.LookPath("makensis.exe")
	if err != nil {
		t.Skip("makensis.exe is required for the NSIS installer behavior test")
	}

	windowsDir := os.Getenv("WINDIR")
	if windowsDir == "" {
		windowsDir = `C:\Windows`
	}
	// Current Windows Notepad is a forwarding launcher, so a renamed copy does
	// not retain the northwing.exe process image. Windows PowerShell is a
	// single-process fixture with a normal close request and no child process.
	initialSource := filepath.Join(windowsDir, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	replacementSource := filepath.Join(windowsDir, "System32", "cmd.exe")
	for _, path := range []string{initialSource, replacementSource} {
		if info, err := os.Stat(path); err != nil || !info.Mode().IsRegular() {
			t.Skipf("Windows fixture executable unavailable: %s", path)
		}
	}

	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	installDir := filepath.Join(t.TempDir(), "installed")
	helperSource := replacementSource
	initialInstaller := buildNorthwingInstallerForTest(t, makensis, root, initialSource, helperSource, "initial")
	install := exec.Command(initialInstaller, "/S", "/D="+installDir)
	if output, err := install.CombinedOutput(); err != nil {
		t.Fatalf("install initial Northwing fixture: %v\n%s", err, output)
	}

	installedExe := filepath.Join(installDir, "northwing.exe")
	installedHelper := filepath.Join(installDir, "northwing-update-helper.exe")
	beforeExe, err := os.ReadFile(installedExe)
	if err != nil {
		t.Fatalf("read installed executable: %v", err)
	}
	beforeHelper, err := os.ReadFile(installedHelper)
	if err != nil {
		t.Fatalf("read installed helper: %v", err)
	}

	stopMarker := filepath.Join(t.TempDir(), "stop")
	readyMarker := filepath.Join(t.TempDir(), "ready")
	fixtureProfile := t.TempDir()
	appData := filepath.Join(fixtureProfile, "AppData")
	localAppData := filepath.Join(fixtureProfile, "LocalAppData")
	if err := os.MkdirAll(appData, 0o700); err != nil {
		t.Fatalf("create fixture APPDATA: %v", err)
	}
	if err := os.MkdirAll(localAppData, 0o700); err != nil {
		t.Fatalf("create fixture LOCALAPPDATA: %v", err)
	}
	quotedReadyMarker := strings.ReplaceAll(readyMarker, "'", "''")
	quotedStopMarker := strings.ReplaceAll(stopMarker, "'", "''")
	running := exec.Command(
		installedExe,
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		fmt.Sprintf("$null = New-Item -ItemType File -Path '%s' -Force; while (-not (Test-Path -LiteralPath '%s')) { Start-Sleep -Milliseconds 50 }", quotedReadyMarker, quotedStopMarker),
	)
	running.Env = append(
		os.Environ(),
		"APPDATA="+appData,
		"LOCALAPPDATA="+localAppData,
		"PSModuleAnalysisCachePath="+filepath.Join(fixtureProfile, "ModuleAnalysisCache"),
	)
	if err := running.Start(); err != nil {
		t.Fatalf("start live Northwing fixture: %v", err)
	}
	runningExited := make(chan error, 1)
	go func() { runningExited <- running.Wait() }()
	fixtureClosed := false
	t.Cleanup(func() {
		if fixtureClosed || running.ProcessState != nil {
			return
		}
		// Isolation only after a failed assertion before the normal close below.
		cleanup := exec.Command("taskkill.exe", "/PID", strconv.Itoa(running.Process.Pid), "/F")
		if output, err := cleanup.CombinedOutput(); err != nil {
			t.Logf("force-clean failed Northwing fixture: %v\n%s", err, output)
		}
		select {
		case <-runningExited:
		case <-time.After(5 * time.Second):
		}
	})
	assertWindowsProcessImage(t, running.Process.Pid, "northwing.exe")
	waitForNorthwingFixtureReady(t, readyMarker, runningExited)

	replacementInstaller := buildNorthwingInstallerForTest(t, makensis, root, replacementSource, helperSource, "replacement")
	update := exec.Command(replacementInstaller, "/S", "/NORTHWING_UPDATE=1", "/D="+installDir)
	if err := update.Start(); err != nil {
		t.Fatalf("start silent update installer: %v", err)
	}
	updateExited := make(chan error, 1)
	go func() { updateExited <- update.Wait() }()

	var updateErr error
	select {
	case updateErr = <-updateExited:
	case <-time.After(5 * time.Second):
		_ = update.Process.Kill()
		<-updateExited
		t.Fatal("silent live-app update installer did not fail quickly")
	}
	if updateErr == nil {
		t.Fatal("silent live-app update installer succeeded while Northwing was still running")
	}
	select {
	case exitErr := <-runningExited:
		t.Fatalf("silent update installer terminated live Northwing: %v", exitErr)
	default:
	}
	afterExe, err := os.ReadFile(installedExe)
	if err != nil {
		t.Fatalf("read executable after rejected update: %v", err)
	}
	afterHelper, err := os.ReadFile(installedHelper)
	if err != nil {
		t.Fatalf("read helper after rejected update: %v", err)
	}
	if !bytes.Equal(afterExe, beforeExe) {
		t.Fatal("silent live-app update modified northwing.exe")
	}
	if !bytes.Equal(afterHelper, beforeHelper) {
		t.Fatal("silent live-app update modified northwing-update-helper.exe")
	}
	stopNorthwingFixture(t, running, runningExited, stopMarker)
	fixtureClosed = true
}

func stopNorthwingFixture(t *testing.T, running *exec.Cmd, exited <-chan error, stopMarker string) {
	t.Helper()
	if err := os.WriteFile(stopMarker, nil, 0o600); err != nil {
		t.Fatalf("request normal Northwing fixture exit: %v", err)
	}
	select {
	case err := <-exited:
		if err != nil {
			t.Fatalf("Northwing fixture did not exit cleanly: %v", err)
		}
	case <-time.After(5 * time.Second):
		// The voluntary exit request timed out, so force termination is limited
		// to test isolation rather than the successful behavior path.
		cleanup := exec.Command("taskkill.exe", "/PID", strconv.Itoa(running.Process.Pid), "/F")
		if output, err := cleanup.CombinedOutput(); err != nil {
			t.Logf("force-clean timed out Northwing fixture: %v\n%s", err, output)
		}
		select {
		case <-exited:
		case <-time.After(5 * time.Second):
		}
		t.Fatal("Northwing fixture did not exit after its voluntary exit request")
	}
}

func waitForNorthwingFixtureReady(t *testing.T, readyMarker string, exited <-chan error) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(readyMarker); err == nil {
			return
		} else if !os.IsNotExist(err) {
			t.Fatalf("check Northwing fixture readiness: %v", err)
		}
		select {
		case err := <-exited:
			t.Fatalf("Northwing fixture exited before readiness: %v", err)
		default:
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("Northwing fixture did not reach its stop-marker loop within 15 seconds")
}

func assertWindowsProcessImage(t *testing.T, pid int, expected string) {
	t.Helper()
	query := exec.Command("tasklist.exe", "/FI", fmt.Sprintf("PID eq %d", pid), "/NH")
	output, err := query.CombinedOutput()
	if err != nil {
		t.Fatalf("query Northwing fixture image name: %v\n%s", err, output)
	}
	fields := strings.Fields(string(output))
	if len(fields) == 0 || !strings.EqualFold(fields[0], expected) {
		t.Fatalf("Northwing fixture image name = %q, want %q; tasklist output: %s", firstField(fields), expected, output)
	}
}

func firstField(fields []string) string {
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

func buildNorthwingInstallerForTest(t *testing.T, makensis, root, executable, helper, label string) string {
	t.Helper()
	output := filepath.Join(root, "Northwing-0.0.0-windows-x64-setup.exe")
	if err := os.Remove(output); err != nil && !os.IsNotExist(err) {
		t.Fatalf("remove previous test installer: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(output) })
	script := filepath.Join(root, "scripts", "windows", "northwing-installer.nsi")
	command := exec.Command(
		makensis,
		"/INPUTCHARSET",
		"UTF8",
		"/DAPP_VERSION=0.0.0",
		"/DAPP_SOURCE_EXE="+executable,
		"/DAPP_UPDATE_HELPER="+helper,
		script,
	)
	command.Dir = root
	if outputText, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build %s installer: %v\n%s", label, err, outputText)
	}
	if _, err := os.Stat(output); err != nil {
		t.Fatalf("%s installer output: %v", label, err)
	}
	copyPath := filepath.Join(t.TempDir(), fmt.Sprintf("northwing-%s-setup.exe", label))
	input, err := os.ReadFile(output)
	if err != nil {
		t.Fatalf("read %s installer: %v", label, err)
	}
	if err := os.WriteFile(copyPath, input, 0o700); err != nil {
		t.Fatalf("write %s installer: %v", label, err)
	}
	if err := os.Remove(output); err != nil {
		t.Fatalf("remove %s installer output: %v", label, err)
	}
	return copyPath
}
