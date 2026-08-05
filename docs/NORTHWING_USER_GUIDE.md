# Northwing User Guide

> From intent to finished work. / 从目标到成品。

Northwing is a local-first CoWork desktop application powered by the complete Reasonix kernel. It keeps Reasonix sessions, Goal mode, Planner/Executor collaboration, Skills, MCP, Hooks, subagents, permissions, sandboxing, checkpoints, rewind, recovery, terminal, Git, remote workspaces, ACP, bots, and developer workflows.

## 1. Install on Windows

Northwing publishes two Windows x64 packages:

- `Northwing-<version>-windows-x64-setup.exe` — per-user installer. Administrator rights are not required.
- `Northwing-<version>-windows-x64-portable.zip` — portable package.

Verify the downloaded file against `Northwing-<version>-SHA256SUMS.txt` before running it.

The installer adds:

- a Start Menu shortcut;
- an uninstaller;
- the `northwing://` URL protocol;
- a per-user installation under `%LOCALAPPDATA%\Programs\Northwing`.

Unsigned preview builds may trigger Windows SmartScreen. Inspect the release page and SHA-256 checksum before choosing **More info → Run anyway**.

## 2. First launch and OpenCode Go

Open the **Work** tab in the left sidebar. The OpenCode Go card uses Reasonix's existing secure Provider configuration and installs two official presets:

- OpenCode Go OpenAI-compatible protocol;
- OpenCode Go Anthropic-compatible protocol.

Enter your own OpenCode Go API key. Northwing configures these default roles:

- execution: `deepseek-v4-flash`;
- planning and review: `deepseek-v4-pro`;
- subagent work: `qwen3.7-plus`.

OpenCode Zen remains optional. Existing third-party Providers are preserved and can still be edited in **Settings → Model**.

## 3. Chat and Work

### Chat

Use Chat for questions, discussion, analysis, short drafting, coding, and direct Reasonix operation. It keeps the ordinary Reasonix tool prefix and does not load Northwing Office tools unless explicitly enabled.

### Work

Use Work when the result should be a completed file or multi-step outcome. A Work brief contains:

1. goal;
2. source materials;
3. deliverable format;
4. constraints;
5. completion criteria.

Northwing stores the Work link before the first model request, creates or reuses a native Reasonix project session, activates Goal mode, and applies the existing Delivery profile. Reasonix remains the authoritative execution state.

## 4. Projects

Choose an existing local folder in the Reasonix project tree and select **Enable CoWork**. Northwing creates only:

```text
<workspace>/.northwing/project.json
```

It does not copy source files, session transcripts, model context, or tool output. Existing Reasonix workspaces remain usable without enabling CoWork.

## 5. Deliverables and versions

Every Work receives a deterministic output directory:

```text
<workspace>/deliverables/<work-id>/
```

After a Reasonix turn completes, Northwing scans that directory locally. Files are hashed with SHA-256. Unchanged content does not create a duplicate version; changed content creates the next Artifact version.

Use **Work and Artifacts** to:

- continue a Work in its exact Reasonix topic/session;
- inspect versions;
- preview text, images, PDFs, and Office structure;
- open a file in its system application;
- reveal the file in Explorer;
- mark one version as final;
- request a scoped revision in the original Work session.

Final selections are stored in `.northwing/final-artifacts.json`. Files are not copied or moved.

## 6. Office deliverables

Northwing adds one stable Reasonix tool named `northwing_office`. It is exposed automatically only in CoWork projects, keeping ordinary Chat sessions' tool schema and cache prefix unchanged.

Supported actions:

- create editable DOCX;
- create editable PPTX;
- create editable XLSX;
- create searchable PDF;
- inspect and validate document structure;
- replace exact text in DOCX, PPTX, or XLSX.

All writes remain subject to Reasonix workspace confinement, permissions, approvals, sandboxing, and subagent path reservations.

## 7. Permissions and safety

Northwing retains Reasonix permission modes. High-impact operations such as destructive file changes, external publication, Git pushes, credential access, or paid services should still require the applicable approval.

Northwing project metadata and Artifact inspection are local operations. They do not make model calls and do not add document bodies to model context.

## 8. Resume and recovery

A saved Work links to its Reasonix topic and exact session path. Opening or continuing the Work restores that session. If an active Goal exists, Northwing resumes it. If the Goal is complete or stopped, it continues in the same session with a new Goal turn.

Reasonix checkpoint, rewind, conflict recovery, autosave, detached runtime, and session lease behavior remain unchanged.

## 9. CLI

The packaged executable supports both desktop and CLI operation:

```powershell
northwing.exe version
northwing.exe run "Summarize the files in this folder"
northwing.exe chat
northwing.exe doctor
northwing.exe mcp list
```

Running `northwing.exe` without arguments opens the desktop. `northwing.exe update` prints the official Northwing release page. All advanced Reasonix kernel commands remain available.

## 10. Updates

Northwing checks only the Northwing fork's `northwing-v*` GitHub Releases. Version 0.1 uses manual updates because Northwing does not yet have an independent signed update manifest. The inherited Reasonix updater remains in the source tree for upstream compatibility but is not used by the Northwing product UI.

## 11. Troubleshooting

### OpenCode Go card reports a conflict

A Provider with the same name was modified or created manually. Northwing preserves it instead of overwriting it. Open **Settings → Model** and resolve or rename the conflicting Provider.

### A generated file is not registered

Confirm that it is inside `deliverables/<work-id>/`, then open **Work and Artifacts** and select **Sync artifacts**. Hidden files, temporary downloads, `.tmp`, `.part`, and incomplete browser downloads are ignored.

### Office preview reports an invalid structure

Open the Artifact in its system application and request a revision. Northwing's deterministic validator checks package entries, XML structure, page/slide/sheet counts, and external relationships.

### Existing Reasonix data is missing

Northwing intentionally uses independent data directories. Existing Reasonix configuration is not overwritten. Explicit `REASONIX_HOME`, `REASONIX_STATE_HOME`, and `REASONIX_CACHE_HOME` variables remain supported for advanced compatibility.

## 12. Data locations

Defaults:

- Windows configuration/state: `%APPDATA%\Northwing`;
- Windows cache: `%LOCALAPPDATA%\Northwing` or the platform cache directory;
- Unix-like systems: `~/.northwing` plus the platform cache directory.

Override with:

- `NORTHWING_HOME`;
- `NORTHWING_STATE_HOME`;
- `NORTHWING_CACHE_HOME`.
