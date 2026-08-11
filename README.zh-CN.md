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

目前 GitHub 上已经发布的 Northwing Windows 安装包均未签名。Windows 可能显示
“未知发布者”或 SmartScreen 警告。运行前请核对发布来源并验证公开的 SHA-256
校验和。0.3.1 Stable 工作流在签名缺失时会直接失败，不会发布未签名 Stable 包。

macOS 与 Linux 版本正在准备中。

## 代码签名

Northwing 正在申请 SignPath Foundation 开源项目计划，当前仍在审核中。下面的服务
声明不代表现有安装包已经获得签名：

> Free code signing provided by SignPath.io, certificate by SignPath Foundation.

[Northwing 代码签名政策](./docs/NORTHWING_CODE_SIGNING_POLICY.md)记录可信构建路径、
签名文件范围、当前状态、维护者职责、发布质量门，以及与上游 Reasonix SignPath
项目的权限边界。每个文件的实际签名状态以对应 GitHub Release 页面为准。

## 隐私与联网行为

Northwing 把项目和会话数据保存在本机，但它不是完全离线应用。用户配置的 AI
provider 和集成会收到完成请求所需的数据；GitHub 提供更新元数据和下载；可选的
桌面启动统计、聚合指标与脱敏诊断使用继承自 Reasonix 的服务端点。桌面统计与
聚合指标目前默认开启，可以分别关闭。

[Northwing 隐私政策](./docs/NORTHWING_PRIVACY_POLICY.md)完整记录数据类别、接收方、
关闭方式、保留限制与删除方法。

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
  [隐私政策](./docs/NORTHWING_PRIVACY_POLICY.md) ·
  [代码签名政策](./docs/NORTHWING_CODE_SIGNING_POLICY.md) ·
  [工具合约](./docs/NORTHWING_TOOL_CONTRACT.zh-CN.md) ·
  [第三方声明](./THIRD_PARTY_NOTICES.md)
- **引擎参考（Reasonix 内核）：** [指南](./docs/GUIDE.zh-CN.md) ·
  [CLI 命令参考](./docs/CLI.zh-CN.md) · [配置路径](./docs/CONFIG_PATHS.zh-CN.md) ·
  [规格](./docs/SPEC.zh-CN.md)

## 许可证

MIT —— 见 [LICENSE](./LICENSE)。Northwing 是基于上游
[Reasonix 仓库](https://github.com/esengine/DeepSeek-Reasonix)的
[冻结基线](./docs/REASONIX_BASELINE.md)构建的独立产品；Reasonix 保留 MIT 许可，
版权归其原作者所有。
