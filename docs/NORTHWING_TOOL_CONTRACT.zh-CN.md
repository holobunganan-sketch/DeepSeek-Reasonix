# Northwing 工具合约扩展

Northwing 完整保留 Reasonix 内置工具合约。原生 Work 会话继续使用 Reasonix 已有的模型目录、Goal、Delivery、权限、沙箱、检查点、恢复、Skills、MCP 与子智能体系统，同时增加一个产品专属能力。

| 工具 | Read-only | 说明 |
| --- | --- | --- |
| `northwing_office` | false | 创建、检查、验证或修改可编辑的 DOCX、PPTX、XLSX 与可搜索 PDF 成品。每次调用只执行一个动作；正式文件应写入当前 Work 的 `deliverables/<work-id>/` 目录。 |

## 暴露规则

`northwing_office` 会注册到应用二进制中，普通 Reasonix Chat 工作区默认不会把它加入模型工具面。工作区存在 `.northwing/project.json` 时自动启用；用户也可以在 `[tools].enabled` 中显式启用。

首次创建原生 Work 时会按需生成 `.northwing/project.json`。Work 创建界面不会安装 Provider，也不会要求再次输入 API Key。模型选择直接读取 Reasonix 已配置模型目录，不改变工具 schema。

## Harness 使用方式

WorkSpec 编译器可以通过 Reasonix 原有 Delivery 合约要求 Office 文件创建与检查。快速、标准和深度质量策略控制用户任务契约中的审阅与验证深度，不注册额外动态工具，也不增加第二套 Agent Loop。
