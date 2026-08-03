# Northwing 工具合约扩展

Northwing完整保留Reasonix内置工具合约，并增加以下产品专属能力。测试会同时校验本扩展与`TOOL_CONTRACT.md`，从而保持上游Reasonix文档易于同步。

| 工具 | Read-only | 说明 |
| --- | --- | --- |
| `northwing_office` | false | 创建、检查、验证或修改可编辑的DOCX、PPTX、XLSX与PDF成品。每次调用只执行一个动作；正式文件应写入当前Work的deliverables目录。 |

## 暴露规则

`northwing_office`会注册到应用二进制中，但普通Reasonix工作区默认不会把它加入模型工具面。工作区存在`.northwing/project.json`时自动启用；用户也可以在`[tools].enabled`中显式启用。

这样可以保持普通Chat和上游Reasonix会话原有的提示词/工具前缀，同时让Northwing Work项目具备原生Office成品能力，并且不引入第二套Agent Loop或动态工具清单。
