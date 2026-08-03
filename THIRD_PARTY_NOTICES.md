# Third-Party Notices

Northwing is a modified distribution built on the Reasonix project and preserves the complete Reasonix kernel and its MIT license.

## Reasonix

Copyright (c) 2026 Reasonix Contributors

Reasonix is licensed under the MIT License. The complete license text is included in the repository and distribution as `LICENSE`.

Northwing-specific changes include the CoWork product layer, Office capability pack, OpenCode Go setup, independent product identity, packaging, and release infrastructure. These changes do not remove upstream copyright or license notices.

## Go and JavaScript dependencies

Northwing also includes third-party open-source packages declared in:

- `go.mod` and `go.sum`;
- `desktop/go.mod` and `desktop/go.sum`;
- `desktop/frontend/package.json` and `desktop/frontend/pnpm-lock.yaml`.

Those packages remain subject to their respective licenses. Release builds must retain this notice and the main `LICENSE`. Where a dependency requires reproduction of its license text, the release workflow should generate or bundle the corresponding dependency license report before a final public release.

## Major embedded frameworks

The distribution includes or uses components such as Wails, React, TypeScript, Lucide, Mermaid, KaTeX, xterm.js, Fyne systray, and other packages listed in the dependency manifests. Product names and trademarks belong to their respective owners.

## Model and service names

OpenCode Go, OpenCode Zen, DeepSeek, Qwen, Anthropic, OpenAI, and other Provider/model names identify compatible external services. Northwing does not distribute their models or API credentials. Users supply and control their own service accounts and keys.
