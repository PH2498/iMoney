---
name: test-report-skill
description: 执行测试后自动解析结果并生成结构化、可读性强的标准测试报告。支持 Jest/Vitest/pytest/JUnit XML，默认输出 Markdown，含摘要、明细、失败分析、覆盖率四大板块。
activation: on_demand
version: 1.0.0
---

# test-report-skill

## 触发意图示例（FR4.1）

当用户表达以下意图之一时，触发本 Skill：

- 「生成测试报告」
- 「跑一下测试并出报告」
- 「把这个 junit.xml 转成测试报告」
- 「测试结果出个报告」
- 「帮我跑测试并生成报告」

触发后自动判断进入**执行模式**或**解析模式**（取决于是否检测到 `result_file`）。

## 配置项（FR4.2）

所有配置项均有默认值，用户可覆盖。覆盖后以用户值为准（D7 配置合并优先级）。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `test_command` | 自动检测 | 测试执行命令；设为 `auto` 时按 FR1.1 优先级检测 |
| `result_file` | 自动检测 | 解析模式下的结果文件路径；指定时进入解析模式 |
| `output_format` | `markdown` | 可选值：`markdown` / `html` / `json` |
| `output_path` | `reports/` | 报告输出目录 |
| `coverage` | `auto` | `auto`（有则展示）/ `on`（强制尝试获取）/ `off`（跳过） |
| `fail_threshold` | 无（不启用） | 通过率低于该百分比时报告结论标记为不达标 |

## 双模式说明（FR1.3）

### 执行模式

用户未指定 `result_file` 时进入执行模式：

1. FrameworkDetector 按优先级识别框架与运行命令（FR1.1）
2. 使用 `background_exec` 触发测试运行（D4 后台任务解耦）
3. 收集结果文件路径
4. 交由 ParserRegistry 解析

### 解析模式

用户指定了 `result_file`（如 `./junit.xml`、`./test-results.json`）时进入解析模式：

1. 跳过测试执行
2. 直接读取指定结果文件
3. 交由 ParserRegistry 解析（满足 US4 CI 复用场景）

## 报告结构（FR2）

报告按固定顺序输出六大章节：

1. **报告头**：项目名、生成时间、执行命令、框架/版本、执行环境摘要
2. **结果摘要**：用例总数、通过/失败/跳过数、通过率、总耗时；整体结论用 ✅/❌ 标识
3. **失败用例分析**：每条失败用例含用例名、所属文件、错误信息、堆栈关键行（截断至 20 行）
4. **用例明细**：按测试文件分组，超过 200 条时截断并注明
5. **覆盖率**：语句/分支/函数/行覆盖率总表 + 低于阈值文件清单；不存在时标注「未获取」
6. **附录**：原始结果文件路径、生成工具版本

## 支持的框架（FR1.2）

| 框架 | 结果格式 | 优先级 |
|------|----------|--------|
| Jest | JSON reporter | P0 |
| Vitest | JSON reporter | P0 |
| JUnit XML | XML（跨语言兜底） | P0 |
| pytest | JUnit XML / JSON report | P1 |

新增框架只需实现 `parse() -> TestResultModel` 并注册到 ParserRegistry（NFR5）。

## 使用方法

### 执行模式（自动跑测试）

```
> 生成测试报告
```

Skill 将自动检测项目框架（Jest/Vitest/pytest），运行测试并生成报告。

### 解析模式（已有结果文件）

```
> 把这个 junit.xml 转成测试报告
```

Skill 将跳过测试执行，直接解析指定的结果文件。

### 带配置参数

```
> 生成测试报告，output_format=html, fail_threshold=80
```

## 运行方式

本 Skill 的解析器、生成器均为 TypeScript 源码（`.ts`）。运行方式：

```bash
# 使用 tsx 或 ts-node 运行
npx tsx skills/test-report-skill/orchestrator.ts

# 或编译后运行
tsc skills/test-report-skill/**/*.ts --outDir dist/test-report-skill
node dist/test-report-skill/orchestrator.js
```

## 安全说明（NFR3）

- 报告中不得泄露环境变量、密钥类内容
- 错误堆栈须过滤敏感路径外的凭据信息
- `SecurityFilter` 在报告生成前强制运行（D3）
- 过滤模式：`process.env.*`、`$ENV_*`、`password=...`、`token=...`、`Bearer ...`、`AKIA[0-9A-Z]{16}`
- 敏感路径：`$HOME`、`/Users/<name>`、`C:\Users\<name>` 替换为 `<redacted>`

## 架构概览

```
SKILL.md 入口 → 模式判定(执行/解析) → 配置合并
     │
     ├─ 执行模式: FrameworkDetector → background_exec → 收集结果文件
     └─ 解析模式: 直接读取 result_file
     │
     ▼
ParserRegistry (jest/vitest/junit/pytest) → TestResultModel
     │
     ▼
SecurityFilter (NFR3 凭据过滤)
     │
     ▼
ReportGenerator (markdown/html/json) → 落盘 reports/test-report-*.md
```
