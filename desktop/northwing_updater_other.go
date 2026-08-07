//go:build !windows

package main

import "errors"

func (a *App) handoffNorthwingUpdate(requestID, expectedVersion, installerPath, helperPath, stagingDir string, assetSize int64) error {
	return errors.New("northwing update: Windows replacement helper is unavailable on this platform")
}
