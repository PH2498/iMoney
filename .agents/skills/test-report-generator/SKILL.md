---
name: test-report-generator
description: 测试执行后自动解析测试结果并生成结构化、可读性强的标准测试报告。支持 Jest/Vitest JSON、JUnit XML 解析、执行/解析双模式、Markdown 默认输出。
activation: auto
tags:
  - testing
  - report
  - jest
  - vitest
  - junit
  - markdown
version: 1.0.0
---

# test-report-generator（测试报告生成器）

## 1. 概述

提供一个 Skill，Agent 在执行测试后能够自动解析测试结果并生成结构化、可读性强的标准测试报告。

一句话指令（如「生成测试报告」）即可自动完成：执行测试 → 收集结果 → 生成报告。

## 2. 支持范围（P0）

- **框架解析**：Jest（JSON reporter）、Vitest（JSON reporter）、JUnit XML（跨语言兜底）
- **工作模式**：执行模式（触发测试运行并收集结果）、解析模式（跳过执行，直接解析已有结果文件）
- **输出格式**：Markdown（默认）；JSON 结构化数据作为伴随产物
- **默认落盘路径**：`reports/test-report-<YYYYMMDD-HHmmss>.md`

## 3. 报告标准结构

生成的报告包含以下章节，顺序固定：

1. 报告头：项目名、生成时间、执行命令、框架/版本、执行环境摘要
2. 结果摘要：用例总数、通过/失败/跳过数、通过率、总耗时；整体结论 ✅ / ❌
3. 失败用例分析（有失败时必选）：用例名、所属文件、错误信息、堆栈关键行
4. 用例明细：按测试文件分组的用例列表与各自耗时（超过 200 条截断并注明）
5. 覆盖率（若可获取）：语句/分支/函数/行覆盖率总表，低于阈值的文件清单
6. 附录：原始结果文件路径、生成工具版本

## 4. 配置项

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| test_command | 自动检测 | 测试执行命令 |
| result_file | 自动检测 | 解析模式下的结果文件路径 |
| output_format | markdown | markdown / html / json |
| output_path | reports/ | 报告输出目录 |
| coverage | auto | auto / on / off |
| fail_threshold | 无 | 通过率低于该值时报告结论标记为不达标 |

## 5. 非功能约束

- 结果解析与报告生成（不含测试执行本身）应在 5 秒内完成（1000 用例规模）
- 结果文件格式异常、字段缺失时降级输出（缺失项标注「未获取」），不得崩溃或静默丢数据
- 报告中不得泄露环境变量、密钥类内容；错误堆栈须过滤敏感路径外的凭据信息
- 同一结果文件多次生成报告，内容一致（时间戳字段除外）
- 框架解析器采用插件式结构，新增框架支持不影响既有解析器

## 6. 实现结构

```
.agents/skills/test-report-generator/
├── SKILL.md                       # 本文件，技能定义与使用指引
├── references/
│   └── framework-adapters.md     # 框架适配说明（执行命令、reporter 配置、覆盖率）
├── scripts/
│   └── test-report-generator.ts  # 主实现：解析器、报告生成器、双模式编排
└── README.md                     # 使用示例与触发意图
```

## 7. 触发意图示例

- 「生成测试报告」
- 「跑一下测试并出报告」
- 「把这个 junit.xml 转成测试报告」

## 8. 使用方式

Agent 识别到上述意图后，按以下流程执行：

1. **解析模式**（用户提供结果文件）：直接调用 `scripts/test-report-generator.ts` 的解析与生成逻辑。
2. **执行模式**（无结果文件）：自动识别框架与运行命令 → 执行测试（长任务交由后台执行并轮询）→ 收集结果 → 生成报告。

生成后向用户返回：报告路径 + 结果摘要（通过率、失败数），失败时附最关键的 1~3 条失败原因。
