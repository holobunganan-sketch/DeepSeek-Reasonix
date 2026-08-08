<p align="center">
  <strong>Northwing</strong>
</p>

<p align="center">
  <em>From intent to finished work.</em>
</p>

<p align="center">
  <strong>English</strong>
  &nbsp;·&nbsp;
  <a href="./README.zh-CN.md">简体中文</a>
  &nbsp;·&nbsp;
  <a href="./docs/NORTHWING_USER_GUIDE.md">User Guide</a>
  &nbsp;·&nbsp;
  <a href="./docs/NORTHWING_ARCHITECTURE.md">Architecture</a>
  &nbsp;·&nbsp;
  <a href="./docs/NORTHWING_RELEASE_NOTES.md">Release Notes</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/holobunganan-sketch/DeepSeek-Reasonix">GitHub</a>
</p>

<p align="center">
  <a href="https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases"><img src="https://img.shields.io/github/v/release/holobunganan-sketch/DeepSeek-Reasonix?style=flat-square&color=3fb950&labelColor=161b22&label=release" alt="release"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/holobunganan-sketch/DeepSeek-Reasonix?style=flat-square&color=8b949e&labelColor=161b22" alt="license"/></a>
  <a href="https://github.com/holobunganan-sketch/DeepSeek-Reasonix/stargazers"><img src="https://img.shields.io/github/stars/holobunganan-sketch/DeepSeek-Reasonix?style=flat-square&color=dbab09&labelColor=161b22&logo=github&logoColor=white" alt="GitHub stars"/></a>
  <a href="https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases"><img src="https://img.shields.io/badge/platform-windows%20x64-0078d6?style=flat-square&labelColor=161b22" alt="platform"/></a>
</p>

<br/>

Northwing is a local-first knowledge-work desktop application built on the complete
Reasonix kernel. Chat and Work share the same workspace, the same configured
providers and models, and the same tools, permissions, checkpoints, and recovery
system.

- **Chat** is an ordinary Reasonix session for questions, discussion, drafting,
  coding, and direct tool work.
- **Work** is a Reasonix session bound to a goal, a delivery policy, and a
  versioned artifact boundary. It takes an intent and returns a finished file.

## Features

- **Native Work sessions.** A Work is a native Reasonix project session with
  Goal and Delivery enabled, a structured quality policy (Quick / Standard /
  Deep), a persisted executor model binding, and a deterministic
  `deliverables/<work-id>/` output directory.
- **Chat and Work in one workspace.** The project create menu offers Chat, Work,
  and Add project folder as one native entry. Work rows reuse the project-tree
  runtime states and show quality plus acceptance progress.
- **Local-first by design.** Northwing stores only compact metadata in
  `<workspace>/.northwing/` — Work links, quality and source policy, artifact
  hashes and versions. No transcript, provider secret, model configuration, or
  tool output is copied.
- **The full kernel underneath.** Providers, model catalog, subagents, Skills,
  MCP, Hooks, permissions, approvals, sandboxing, checkpoints, rewind, and
  recovery all come from the Reasonix engine. Any OpenAI-compatible, Anthropic-
  compatible, GLM, Kimi, or OpenCode Go endpoint is a configured entry, not new
  code.
- **Native Office deliverables.** Editable DOCX, PPTX, and XLSX, plus searchable
  PDF, generated locally with structure validation and independent
  interoperability checks.
- **Independent distribution and updates.** Northwing checks only the
  `northwing-v*` release line, ships a Windows x64 installer with verified
  automatic updates, and publishes SHA-256 checksums for every package.

## Install

Current release: **Northwing 0.2.0** (Windows x64). Download from
[GitHub Releases](https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases):

| Package | Notes |
| --- | --- |
| `Northwing-0.2.0-windows-x64-setup.exe` | Per-user installer with automatic updates |
| `Northwing-0.2.0-windows-x64-portable.zip` | Portable package, no installation |
| `Northwing-0.2.0-SHA256SUMS.txt` | Verify the selected package before running it |

Preview builds may display a Windows SmartScreen warning because they are not
signed. Review the release source and checksum before proceeding.

macOS and Linux builds are in preparation.

## Quick start

1. Install the Windows x64 installer, or unpack the portable ZIP and launch
   `northwing`.
2. Open **Settings → Model** and configure a provider. DeepSeek, OpenAI-
   compatible, Anthropic-compatible, GLM, and Kimi endpoints are available as
   presets or plain configuration.
3. Create a **Work** from the project sidebar. Set a goal, optional materials,
   work type, delivery quality, and executor model.
4. Work produces into `deliverables/<work-id>/`. Track artifact versions, preview
   and validate Office files, and mark a final artifact from the Work-scoped
   Artifact drawer.

For the full workflow, see the
**[Northwing User Guide](./docs/NORTHWING_USER_GUIDE.md)**.

## Documentation

- **Northwing:** [User Guide](./docs/NORTHWING_USER_GUIDE.md) ·
  [Architecture](./docs/NORTHWING_ARCHITECTURE.md) ·
  [Release Notes](./docs/NORTHWING_RELEASE_NOTES.md) ·
  [Tool Contract](./docs/NORTHWING_TOOL_CONTRACT.md)
- **Engine reference (Reasonix kernel):** [Guide](./docs/GUIDE.md) ·
  [CLI reference](./docs/CLI.md) · [Configuration paths](./docs/CONFIG_PATHS.md) ·
  [Spec](./docs/SPEC.md)

## License

MIT — see [LICENSE](./LICENSE). Northwing is an independent product built on the
Reasonix kernel; Reasonix remains MIT-licensed, © its original authors.
