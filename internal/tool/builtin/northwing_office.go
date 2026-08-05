package builtin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"reasonix/internal/office"
	"reasonix/internal/tool"
)

func init() { tool.RegisterBuiltin(northwingOffice{}) }

// northwingOffice is one stable schema over the Office capability pack. The
// per-workspace instance replaces this zero-value template in Workspace.Tools.
type northwingOffice struct {
	workDir      string
	projectRoots []string
	roots        []string
	forbidRoots  []string
	guard        SessionDataGuard
	managed      ManagedConfigPaths
}

func (northwingOffice) Name() string { return "northwing_office" }

func (northwingOffice) Description() string {
	return "Create, inspect, validate, or revise editable DOCX, PPTX, XLSX, and PDF deliverables. Use one action per call; formal outputs should be written under the active Work's deliverables directory."
}

func (northwingOffice) Schema() json.RawMessage {
	return json.RawMessage(`{
  "type":"object",
  "properties":{
    "action":{"type":"string","enum":["create_docx","create_pptx","create_xlsx","create_pdf","inspect","validate","replace_text"],"description":"Office operation"},
    "path":{"type":"string","description":"Workspace-relative output or input path"},
    "title":{"type":"string","description":"Document, presentation, or PDF title"},
    "text":{"type":"string","description":"Plain body text for DOCX or PDF creation"},
    "sections":{"type":"array","items":{"type":"object","properties":{"heading":{"type":"string"},"paragraphs":{"type":"array","items":{"type":"string"}}}},"description":"DOCX sections"},
    "slides":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"bullets":{"type":"array","items":{"type":"string"}}}},"description":"PPTX slides"},
    "sheets":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"rows":{"type":"array","items":{"type":"array","items":{}}}}},"description":"XLSX worksheets and cell rows"},
    "find":{"type":"string","description":"Exact text to replace in an editable Office package"},
    "replace":{"type":"string","description":"Replacement text"}
  },
  "required":["action","path"],
  "additionalProperties":false
}`)
}

func (northwingOffice) ReadOnly() bool     { return false }
func (northwingOffice) PlanModeSafe() bool { return false }

func (n northwingOffice) Execute(ctx context.Context, args json.RawMessage) (string, error) {
	var req office.Request
	if err := json.Unmarshal(args, &req); err != nil {
		return "", fmt.Errorf("invalid args: %w", err)
	}
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if strings.TrimSpace(req.Path) == "" {
		return "", fmt.Errorf("path is required")
	}
	req.Path = resolveIn(n.workDir, req.Path)
	if err := confine(n.projectRoots, req.Path); err != nil {
		return "", fmt.Errorf("Northwing Office path %q is outside the active workspace", req.Path)
	}
	switch req.Action {
	case "inspect", "validate":
		if confineRead(n.forbidRoots, req.Path) {
			return "", fmt.Errorf("path %q is not readable under the current Reasonix policy", req.Path)
		}
	case "create_docx", "create_pptx", "create_xlsx", "create_pdf", "replace_text":
		if err := confineWrite(ctx, n.roots, n.guard, n.managed, req.Path); err != nil {
			return "", err
		}
	default:
		return "", fmt.Errorf("unsupported Northwing Office action %q", req.Action)
	}
	report, err := office.Execute(req)
	if err != nil {
		return "", err
	}
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}
