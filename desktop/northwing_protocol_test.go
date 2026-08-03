package main

import "testing"

func TestParseNorthwingLaunch(t *testing.T) {
	launch, ok := parseNorthwingLaunch(`northwing://work?workspace=C%3A%5CProjects%5CReport&mode=work`)
	if !ok {
		t.Fatal("Northwing URL was rejected")
	}
	if launch.Action != "work" || launch.Workspace != `C:\Projects\Report` || launch.Mode != "work" {
		t.Fatalf("launch = %+v", launch)
	}
}

func TestParseNorthwingLaunchRejectsOtherSchemes(t *testing.T) {
	if _, ok := parseNorthwingLaunch("https://example.com"); ok {
		t.Fatal("non-Northwing URL was accepted")
	}
}
