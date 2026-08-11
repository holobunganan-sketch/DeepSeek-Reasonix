# Northwing User Guide

> From intent to finished work. / 从目标到成品。

Northwing is a local-first desktop application powered by the complete Reasonix kernel. Chat and Work use the same configured Providers, models, project tabs, sessions, tools, permissions, checkpoints, and recovery system.

## 1. Install on Windows

Northwing publishes two Windows x64 packages:

- `Northwing-<version>-windows-x64-setup.exe` — per-user installer;
- `Northwing-<version>-windows-x64-portable.zip` — portable package.

Verify the selected file against `Northwing-<version>-SHA256SUMS.txt`. All
Northwing Windows packages published before the first signed Stable release are
unsigned and may display an Unknown Publisher or Windows SmartScreen warning.
Check the individual GitHub Release for the authoritative signing status. Future
Stable releases must satisfy the
[Northwing Code Signing Policy](./NORTHWING_CODE_SIGNING_POLICY.md).

## 2. Configure models once

Open **Settings → Model** and configure any Provider supported by Reasonix. Northwing Work can use every model shown by the normal Reasonix model catalog.

The Work dialog does not request a second API key and has no required OpenCode Go account. OpenCode Go remains available as an optional Reasonix Provider preset alongside DeepSeek, OpenAI-compatible, Anthropic-compatible, GLM, Kimi, and other configured endpoints.

Planner, subagent, and reviewer model behavior follows the Reasonix settings. A Work stores its selected executor model and optional reasoning effort so the same binding can be restored later.

## 3. Chat and Work

### Chat

Use an ordinary Reasonix session for questions, discussion, short drafting, coding, analysis, terminal work, and direct tool operation.

### Work

Use **New Work** in the project sidebar when the outcome should be a finished file or a multi-step deliverable. Work creates a native Reasonix project session with:

- Goal enabled;
- Delivery enabled;
- the selected Reasonix model;
- a deterministic formal-output directory;
- a structured quality policy;
- Artifact version tracking.

The project does not need a separate “Enable CoWork” step. Creating the first Work adds only:

```text
<workspace>/.northwing/project.json
```

Source files, transcripts, Provider configuration, credentials, and tool output are not copied.

## 4. Create a Work

The short form asks for:

1. **Goal** — one clear description of the result;
2. **Materials** — optional project-relative file paths;
3. **Work type**;
4. **Delivery quality**;
5. **Evidence policy**;
6. **Executor model** from the configured Reasonix catalog.

Advanced settings contain title, audience, deliverable override, constraints, extra completion criteria, pause policy, and reasoning effort.

### Work types

- **General task** — general finished outputs;
- **Research and evidence** — source-backed research briefs and evidence synthesis;
- **Report / Word** — editable DOCX reports;
- **Presentation / PowerPoint** — editable PPTX decks;
- **Data analysis / Excel** — editable XLSX workbooks and interpretation summaries;
- **Review and revision** — review and scoped modification of existing files;
- **File batch** — deterministic processing of multiple inputs.

### Quality levels

**Quick** uses:

```text
inspect → produce → validate
```

**Standard** uses:

```text
inventory → plan → produce → review → repair → validate
```

**Deep** uses:

```text
inventory → evidence ledger → plan → produce → review
→ independent review → repair → validate → requirement audit
```

Standard is the default.

### Evidence policies

- **Project materials only** — no unsupported external facts;
- **Project-first with web supplementation** — external research fills material gaps and receives citations;
- **Verified web research with citations** — current authoritative sources verify externally checkable claims.

## 5. Harness behavior

The guided form is compiled into one Reasonix task contract containing Context, Request, Materials, Output format, Source policy, Constraints, Acceptance criteria, Pause policy, and Harness execution requirements.

The Harness uses Reasonix Delivery. It requires the agent to:

- create an acceptance list before formal output work;
- save finished files under the Work directory;
- follow the selected evidence policy;
- review and repair at the selected quality depth;
- validate after the latest content change;
- finish only after every acceptance item has evidence.

This structure increases the reliability of low-cost models by reducing ambiguity, separating stages, requiring evidence, and using deterministic validation. Final quality still depends on the selected model, available evidence, and task difficulty.

## 6. Deliverables and versions

Every Work receives:

```text
<workspace>/deliverables/<work-id>/
```

After a Reasonix turn completes, Northwing scans this directory locally. Changed files receive the next Artifact version. Unchanged content does not create duplicates.

Open **Work and artifacts** to:

- continue the exact Reasonix Work session;
- see the Work type, quality, evidence policy, model, and effort;
- inspect versions;
- preview text, images, PDFs, and Office structure;
- open a file in its system application;
- reveal it in Explorer;
- mark a version as final;
- request a scoped revision in the original Work session.

Final selections are stored in:

```text
<workspace>/.northwing/final-artifacts.json
```

Files are not copied or moved when a final version is selected.

## 7. Office deliverables

Northwing includes the stable Reasonix tool `northwing_office` for Work projects. Supported actions include:

- create editable DOCX;
- create editable PPTX;
- create editable XLSX;
- create searchable PDF;
- inspect and validate package structure;
- replace exact text in DOCX, PPTX, and XLSX.

Ordinary Chat sessions do not receive this tool automatically. Work projects receive it through the existing `.northwing/project.json` exposure rule.

## 8. Resume and model restoration

A saved Work links to its Reasonix topic and exact session path. Opening the Work:

1. restores the same Reasonix session;
2. reapplies the saved executor model and optional effort;
3. switches to Delivery;
4. resumes an active Goal or starts one explicit continuation turn.

If the saved model no longer exists in the configured catalog, Northwing reports the missing model reference. Configure or replace the model in **Settings → Model**, then continue the Work.

## 9. Permissions and safety

Work uses Reasonix permission modes, approval prompts, sandbox rules, path confinement, checkpoints, and recovery behavior. External publication, Git pushes, destructive operations, credential access, payments, and other externally visible actions remain subject to the existing policy.

Northwing project metadata and Artifact synchronization are local operations. They do not make model calls and do not inject file bodies into model context.

## 10. CLI

The packaged executable supports desktop and CLI operation:

```powershell
northwing.exe version
northwing.exe run "Summarize the files in this folder"
northwing.exe chat
northwing.exe doctor
northwing.exe mcp list
```

Running `northwing.exe` without arguments opens the desktop. Advanced Reasonix kernel commands remain available.

## 11. Updates

Northwing checks the fork's `northwing-v*` GitHub Releases. Version 0.1 uses manual updates because it does not yet publish an independently signed update manifest.

## 12. Troubleshooting

### New Work shows no model

Open **Settings → Model**, configure a Provider, and confirm the model appears in the normal Composer model switcher.

### A saved Work model is unavailable

The Provider or model was removed after the Work was created. Restore it in Reasonix settings or create a replacement Work with another configured model.

### A generated file is not registered

Confirm that the file is inside `deliverables/<work-id>/`, then open **Work and artifacts** and select **Sync artifacts**. Hidden files, partial downloads, and temporary files are ignored.

### Office preview reports an invalid structure

Open the Artifact in its system application and request a revision. Northwing checks package entries, XML structure, page/slide/sheet counts, and external relationships.

### Existing Reasonix data is missing

Northwing uses independent application directories. Existing Reasonix configuration is not overwritten. Explicit `REASONIX_HOME`, `REASONIX_STATE_HOME`, and `REASONIX_CACHE_HOME` variables remain available for compatibility.

## 13. Data locations

Defaults:

- Windows configuration/state: `%APPDATA%\Northwing`;
- Windows cache: `%LOCALAPPDATA%\Northwing` or the platform cache directory;
- Unix-like systems: `~/.northwing` plus the platform cache directory.

Overrides:

- `NORTHWING_HOME`;
- `NORTHWING_STATE_HOME`;
- `NORTHWING_CACHE_HOME`.
