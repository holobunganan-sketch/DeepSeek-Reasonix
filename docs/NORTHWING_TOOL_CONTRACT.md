# Northwing Tool Contract Extension

Northwing preserves the complete Reasonix built-in tool contract. Native Work sessions add one product-specific capability while continuing to use the existing Reasonix model catalog, Goal, Delivery, permissions, sandbox, checkpoints, recovery, Skills, MCP, and subagent systems.

| Tool | Read-only | Description |
| --- | --- | --- |
| `northwing_office` | false | Create, inspect, validate, or revise editable DOCX, PPTX, XLSX, and searchable PDF deliverables. Use one action per call; formal outputs belong under the active Work's `deliverables/<work-id>/` directory. |

## Exposure rule

`northwing_office` is registered in the binary but is not added to ordinary Reasonix Chat workspaces by default. Its provider-visible schema is exposed automatically when the workspace contains `.northwing/project.json`, or when the user explicitly includes the tool in `[tools].enabled`.

Creating the first native Work lazily creates `.northwing/project.json`. The Work form never installs a Provider or requests an API key. Model selection uses the existing Reasonix catalog and does not change the tool schema.

## Harness use

The WorkSpec compiler can require Office creation and inspection through the normal Delivery contract. Quick, Standard, and Deep policies control review and verification depth in the user-turn task contract. They do not register additional dynamic tools or create another Agent Loop.
