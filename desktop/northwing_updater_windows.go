//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"reasonix/internal/windowsauth"
)

const (
	northwingDetachedProcess       = 0x00000008
	northwingCreateNewProcessGroup = 0x00000200
)

func (a *App) verifyNorthwingBinaryBeforeUpdate(installerPath, helperPath string) error {
	if !windowsauth.IsAvailable() {
		return nil
	}
	if err := windowsauth.VerifyAuthenticode(helperPath); err != nil {
		return fmt.Errorf("northwing update: helper Authenticode verification failed: %w", err)
	}
	if err := windowsauth.VerifyAuthenticode(installerPath); err != nil {
		return fmt.Errorf("northwing update: installer Authenticode verification failed: %w", err)
	}
	return nil
}

func (a *App) handoffNorthwingUpdate(requestID, expectedVersion, installerPath, helperPath, stagingDir string, assetSize int64) error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("northwing update: resolve running executable: %w", err)
	}
	executable, err = filepath.Abs(executable)
	if err != nil {
		return err
	}
	if err := a.verifyNorthwingBinaryBeforeUpdate(installerPath, helperPath); err != nil {
		return err
	}
	command := exec.Command(
		helperPath,
		"--installer", installerPath,
		"--pid", strconv.Itoa(os.Getpid()),
		"--restart", executable,
		"--expected-version", expectedVersion,
		"--cleanup", stagingDir,
	)
	command.Dir = stagingDir
	command.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:       true,
		CreationFlags:    northwingDetachedProcess | northwingCreateNewProcessGroup,
		NoInheritHandles: true,
	}
	if err := command.Start(); err != nil {
		return fmt.Errorf("northwing update: start replacement helper: %w", err)
	}
	a.emitProgress(requestID, "stable", expectedVersion, "installing", assetSize, assetSize, "")
	a.shutdown(a.ctx)
	a.forceQuit.Store(true)
	if a.ctx != nil {
		wruntime.Quit(a.ctx)
	}
	os.Exit(0)
	return nil
}
