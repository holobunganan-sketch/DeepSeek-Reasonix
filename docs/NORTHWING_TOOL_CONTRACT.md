# Northwing Tool Contract Extension

Northwing preserves the Reasonix built-in tool contract and adds the following product-specific capability. This extension is tested together with `TOOL_CONTRACT.md` so upstream Reasonix documentation can remain easy to synchronize.

| Tool | Read-only | Description |
| --- | --- | --- |
| `northwing_office` | false | Create, inspect, validate, or revise editable DOCX, PPTX, XLSX, and PDF deliverables. Use one action per call; formal outputs should be written under the active Work's deliverables directory. |

## Exposure rule

`northwing_office` is registered in the binary but is not added to ordinary Reasonix workspaces by default. Its provider-visible schema is exposed automatically when the workspace contains `.northwing/project.json`, or when the user explicitly includes the tool in `[tools].enabled`.

This rule keeps ordinary Chat and upstream Reasonix sessions on their existing prompt/tool prefix while giving Northwing Work projects native Office output without an additional Agent loop or dynamic schema inventory.
