package main

import (
	"net/url"
	"os"
	"strings"
	"sync"
)

type NorthwingLaunch struct {
	Raw       string `json:"raw"`
	Action    string `json:"action"`
	Workspace string `json:"workspace,omitempty"`
	Mode      string `json:"mode,omitempty"`
}

var northwingLaunchQueue struct {
	sync.Mutex
	items []NorthwingLaunch
}

func init() {
	captureNorthwingLaunches(os.Args[1:])
}

func captureNorthwingLaunches(args []string) {
	for _, arg := range args {
		launch, ok := parseNorthwingLaunch(arg)
		if !ok {
			continue
		}
		northwingLaunchQueue.Lock()
		northwingLaunchQueue.items = append(northwingLaunchQueue.items, launch)
		northwingLaunchQueue.Unlock()
	}
}

func parseNorthwingLaunch(raw string) (NorthwingLaunch, bool) {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil || !strings.EqualFold(u.Scheme, northwingProtocol) {
		return NorthwingLaunch{}, false
	}
	action := strings.ToLower(strings.TrimSpace(u.Host))
	if action == "" {
		action = strings.ToLower(strings.Trim(strings.TrimSpace(u.Path), "/"))
	}
	if action == "" {
		action = "open"
	}
	workspace := strings.TrimSpace(u.Query().Get("workspace"))
	if workspace == "" {
		workspace = strings.TrimSpace(u.Query().Get("path"))
	}
	mode := strings.ToLower(strings.TrimSpace(u.Query().Get("mode")))
	if mode != "chat" && mode != "work" {
		mode = "work"
	}
	return NorthwingLaunch{Raw: raw, Action: action, Workspace: workspace, Mode: mode}, true
}

// PendingNorthwingLaunches drains URL launches captured before the frontend was
// ready or forwarded by a second application instance.
func (a *App) PendingNorthwingLaunches() []NorthwingLaunch {
	northwingLaunchQueue.Lock()
	defer northwingLaunchQueue.Unlock()
	out := append([]NorthwingLaunch(nil), northwingLaunchQueue.items...)
	northwingLaunchQueue.items = nil
	return out
}
