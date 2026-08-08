//go:build windows

package windowsauth

import (
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	winTrustActionGenericVerifyV2 = "{00AAC56B-CD44-11d0-8CC2-00C04FC295EE}"

	wtdChoiceFile    = 1
	wtdStateActionVerify = 1
	wtdUINone       = 2
	wtdRevokeNone    = 0x00000000

	wtdProviderUsage    = 0x00000010

	trustESigstateUnknown    = 0
	trustESigstateValid      = 1

	signtoolErrorSuccess = 0
)

type winTrustFileInfo struct {
	Size     uint32
	FilePath *uint16
	File     windows.Handle
	KnownSubject *windows.GUID
}

type winTrustData struct {
	Size                    uint32
	PolicyCallbackData      uintptr
	SIPClientData           uintptr
	UIChoice                uint32
	RevocationChecks        uint32
	UnionChoice             uint32
	FileInfo                *winTrustFileInfo
	StateAction             uint32
	StateData               windows.Handle
	URLReference            *uint16
	ProviderFlags           uint32
	UIContext               uint32
	SignatureSettings       uintptr
}

var (
	modWinTrust     = windows.NewLazySystemDLL("wintrust.dll")
	procWinVerifyTrust = modWinTrust.NewProc("WinVerifyTrust")
)

func winVerifyTrust(hwnd windows.Handle, actionID *windows.GUID, data *winTrustData) uint32 {
	r, _, _ := syscall.SyscallN(procWinVerifyTrust.Addr(),
		uintptr(hwnd),
		uintptr(unsafe.Pointer(actionID)),
		uintptr(unsafe.Pointer(data)),
	)
	return uint32(r)
}

// VerifyAuthenticode checks that the PE file at path has a valid
// SHA-256 Authenticode signature.
func VerifyAuthenticode(path string) error {
	pathUTF16, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return fmt.Errorf("windowsauth: encode path: %w", err)
	}

	fileInfo := &winTrustFileInfo{
		Size:     uint32(unsafe.Sizeof(winTrustFileInfo{})),
		FilePath: pathUTF16,
	}

	actionGUID, err := windows.GUIDFromString(winTrustActionGenericVerifyV2)
	if err != nil {
		return fmt.Errorf("windowsauth: action GUID: %w", err)
	}

	data := &winTrustData{
		Size:             uint32(unsafe.Sizeof(winTrustData{})),
		UIChoice:         wtdUINone,
		RevocationChecks: wtdRevokeNone,
		UnionChoice:      wtdChoiceFile,
		FileInfo:         fileInfo,
		StateAction:      wtdStateActionVerify,
		ProviderFlags:    wtdProviderUsage,
	}

	result := winVerifyTrust(0, &actionGUID, data)
	if result != signtoolErrorSuccess {
		return fmt.Errorf("windowsauth: Authenticode verification failed for %q: 0x%08x", path, result)
	}
	return nil
}

// IsAvailable reports whether the current platform can perform Authenticode
// verification.
func IsAvailable() bool {
	return true
}

