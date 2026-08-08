package windowsauth

import (
	"os"
	"path/filepath"
	"testing"
)

func TestVerifyAuthenticodeRejectsNonexistentFile(t *testing.T) {
	err := VerifyAuthenticode(filepath.Join(t.TempDir(), "nonexistent.exe"))
	if err == nil {
		t.Fatal("nonexistent file should not verify")
	}
}

func TestVerifyAuthenticodeRejectsNonPEFile(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "test-*.txt")
	if err != nil {
		t.Fatal(err)
	}
	f.WriteString("not a PE file")
	f.Close()
	err = VerifyAuthenticode(f.Name())
	if err == nil {
		t.Fatal("non-PE file should not verify")
	}
}

func TestVerifyAuthenticodeRejectsUnsignedBinary(t *testing.T) {
	// A zero-byte file named .exe is not a valid signed PE.
	dir := t.TempDir()
	path := filepath.Join(dir, "unsigned.exe")
	if err := os.WriteFile(path, []byte{}, 0o644); err != nil {
		t.Fatal(err)
	}
	err := VerifyAuthenticode(path)
	if err == nil {
		t.Fatal("unsigned binary should not verify")
	}
}

func TestIsAvailable(t *testing.T) {
	if !IsAvailable() {
		t.Skip("Authenticode not available on this platform")
	}
}
