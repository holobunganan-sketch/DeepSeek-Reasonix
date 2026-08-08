<p align="center">
  <strong>Northwing</strong>
</p>

<p align="center">
  <em>从目标到成品。</em>
</p>

<p align="center">
  <a href="./README.md">English</a>
  &nbsp;·&nbsp;
  <strong>简体中文</strong>
  &nbsp;·&nbsp;
  <a href="./docs/NORTHWING_USER_GUIDE.md">用户指南</a>
  &nbsp;·&nbsp;
  <a href="./docs/NORTHWING_ARCHITECTURE.md">架构</a>
  &nbsp;·&nbsp;
  <a href="./docs/NORTHWING_RELEASE_NOTES.md">发布说明</a>
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

Northwing 是基于完整 Reasonix 内核构建的本地优先（local-first）知识工作桌面应用。
Chat 与 Work 共用同一工作区、同一批已配置的 provider 和模型，以及同一套工具、
权限、checkpoint 与恢复系统。

- **Chat** 是普通的 Reasonix 会话，用于提问、讨论、起草、写代码和直接操作工具。
- **Work** 是绑定目标、交付策略和版本化工件边界的 Reasonix 会话。给它一个目标，
  它交回一份完成的成品文件。

## 特性

- **原生 Work 会话。** Work 是原生的 Reasonix 项目会话，启用 Goal 与 Delivery，
  带结构化质量策略（Quick / Standard / Deep）、持久化的执行模型绑定，以及确定的
  `deliverables/<work-id>/` 输出目录。
- **同一工作区里的 Chat 与 Work。** 项目创建菜单把 Chat、Work 和添加项目文件夹
  整合为一个原生入口。Work 行复用项目树运行时状态，直接显示质量等级和验收进度。
- **本地优先。** Northwing 只在 `<workspace>/.northwing/` 存放紧凑的元数据——
  Work 链接、质量与来源策略、工件哈希和版本。不复制任何会话记录、provider
  密钥、模型配置或工具输出。
- **完整的内核能力。** provider、模型目录、subagents、Skills、MCP、Hooks、
  权限、审批、沙箱、checkpoint、rewind 与恢复全部来自 Reasonix 引擎。任何
  OpenAI 兼容、Anthropic 兼容、GLM、Kimi 或 OpenCode Go 端点都只是一条配置，
  无需新增代码。
- **原生 Office 交付。** 本地生成可编辑的 DOCX、PPTX、XLSX 与可检索 PDF，
  带结构校验和独立的互操作性检查。
- **独立分发与更新。** Northwing 只检查 `northwing-v*` release 线，提供带校验
  自动更新的 Windows x64 安装程序，并为每个安装包发布 SHA-256 校验和。

## 安装

当前版本：**Northwing 0.2.0**（Windows x64）。从
[GitHub Releases](https://github.com/holobunganan-sketch/DeepSeek-Reasonix/releases) 下载：

| 安装包 | 说明 |
| --- | --- |
| `Northwing-0.2.0-windows-x64-setup.exe` | 按用户安装，带自动更新 |
| `Northwing-0.2.0-windows-x64-portable.zip` | 便携版，无需安装 |
| `Northwing-0.2.0-SHA256SUMS.txt` | 运行前先用它校验所选安装包 |

预览构建可能因未签名而弹出 Windows SmartScreen 警告。运行前请核对发布来源与校验和。

macOS 与 Linux 版本正在准备中。

## 快速开始

1. 安装 Windows x64 安装程序，或解压便携版后启动 `northwing`。
2. 打开 **Settings → Model** 配置 provider。DeepSeek、OpenAI 兼容、Anthropic
   兼容、GLM 和 Kimi 端点都可以作为预设或普通配置使用。
3. 在项目侧边栏新建 **Work**。填写目标、可选材料、工作类型、交付质量和执行模型。
4. Work 的产出进入 `deliverables/<work-id>/`。在 Work 专属的 Artifact 抽屉里
   跟踪工件版本、预览并校验 Office 文件，最后标记定稿工件。

完整流程见 **[Northwing 用户指南](./docs/NORTHWING_USER_GUIDE.md)**。

## 文档

- **Northwing：** [用户指南](./docs/NORTHWING_USER_GUIDE.md) ·
  [架构](./docs/NORTHWING_ARCHITECTURE.md) · [发布说明](./docs/NORTHWING_RELEASE_NOTES.md) ·
  [工具合约](./docs/NORTHWING_TOOL_CONTRACT.zh-CN.md)
- **引擎参考（Reasonix 内核）：** [指南](./docs/GUIDE.zh-CN.md) ·
  [CLI 命令参考](./docs/CLI.zh-CN.md) · [配置路径](./docs/CONFIG_PATHS.zh-CN.md) ·
  [规格](./docs/SPEC.zh-CN.md)

## 许可证

MIT —— 见 [LICENSE](./LICENSE)。Northwing 是基于 Reasonix 内核构建的独立产品；
Reasonix 保留 MIT 许可，版权归其原作者所有。
