# Requirement: Skill 交互约定 (FR4)

## Overview

定义触发意图与可配置项，确保用户可通过自然语言或参数灵活控制 Skill 行为，所有配置项均有默认值。

## Scenarios

### FR4.1 触发意图示例

**Given** 用户使用自然语言
**When** 用户表达以下意图之一
- 「生成测试报告」；
- 「跑一下测试并出报告」；
- 「把这个 junit.xml 转成测试报告」；
**Then** Skill 被触发，并自动判断进入执行模式或解析模式（取决于是否检测到 `result_file`）。

### FR4.2 可配置项

**Given** Skill 配置项
**When** 用户未显式覆盖
**Then** 使用以下默认值：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `test_command` | 自动检测 | 测试执行命令 |
| `result_file` | 自动检测 | 解析模式下的结果文件路径；指定时进入解析模式 |
| `output_format` | `markdown` | 可选值：`markdown` / `html` / `json` |
| `output_path` | `reports/` | 报告输出目录 |
| `coverage` | `auto` | 可选值：`auto`（有则展示）/ `on`（强制尝试获取）/ `off`（跳过） |
| `fail_threshold` | 无（不启用） | 通过率低于该百分比时报告结论标记为不达标 |

**And** 用户可覆盖任一配置项，覆盖后以用户值为准。

## Out of Scope

- 不做 Skill 的 Web UI 配置面板；
- 不做配置项的持久化存储（每次调用读取当前值）。
