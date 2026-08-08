//go:build !windows

package windowsauth

import (
	"errors"
	"runtime"
)

// VerifyAuthenticode checks that a PE file has a valid SHA-256 Authenticode
// signature chaining to a trusted root. On non-Windows platforms this is a
// no-op stub that always returns an error instructing callers to verify on
// a Windows host.
func VerifyAuthenticode(path string) error {
	return errors.New("windowsauth.VerifyAuthenticode is only available on Windows; verify signatures on a Windows host")
}

// IsAvailable reports whether the current platform can perform Authenticode
// verification.
func IsAvailable() bool {
	return runtime.GOOS == "windows"
}

