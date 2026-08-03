package main

import (
	"os"

	"github.com/wailsapp/wails/v2/pkg/options"
)

func singleInstanceLock(app *App) *options.SingleInstanceLock {
	// Allow contributors to run a dev build alongside the installed app. Keep the
	// Reasonix variable for kernel compatibility and add the product-native alias.
	if os.Getenv("NORTHWING_DEV") != "" || os.Getenv("REASONIX_DEV") != "" {
		return nil
	}
	return &options.SingleInstanceLock{
		UniqueId: singleInstanceID(),
		OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
			captureNorthwingLaunches(data.Args)
			app.secondInstanceLaunch()
		},
	}
}
