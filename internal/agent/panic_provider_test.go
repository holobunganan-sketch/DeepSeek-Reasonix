package agent

import (
	"context"
	"testing"

	"reasonix/internal/provider"
)

func TestPanicProviderPanics(t *testing.T) {
	p := panicProvider{name: "subagent-panic"}
	if got := p.Name(); got != "subagent-panic" {
		t.Fatalf("Name() = %q, want subagent-panic", got)
	}
	defer func() {
		if recover() == nil {
			t.Fatal("Stream did not panic")
		}
	}()
	_, _ = p.Stream(context.Background(), provider.Request{})
}
