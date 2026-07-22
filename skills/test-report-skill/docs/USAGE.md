# test-report-skill 使用文档

## 概述

test-report-skill 是一个可复用的 Skill，使 Agent 在执行测试后能够自动解析测试结果并生成结构化、可读性强的标准测试报告。

**核心能力**：一条指令完成「执行测试 → 收集结果 → 生成报告」。

## 触发意图

当用户表达以下意图之一时自动触发：

| 意图示例 | 模式 |
|----------|------|
| 「生成测试报告」 | 执行模式 |
| 「跑一下测试并出报告」 | 执行模式 |
| 「把这个 junit.xml 转成测试报告」 | 解析模式 |
| 「测试结果出个报告」 | 执行模式 |

触发后自动判断进入**执行模式**或**解析模式**（取决于是否检测到 `result_file`）。

## 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `test_command` | 自动检测 | 测试执行命令；`auto` 时按 FR1.1 优先级检测 |
| `result_file` | 自动检测 | 指定结果文件路径时进入解析模式 |
| `output_format` | `markdown` | `markdown` / `html` / `json` |
| `output_path` | `reports/` | 报告输出目录 |
| `coverage` | `auto` | `auto`（有则展示）/ `on`（强制获取）/ `off`（跳过） |
| `fail_threshold` | 无 | 通过率低于该百分比时标记「未达标」 |

配置合并优先级（D7）：用户显式参数 > Skill 默认值。

## 双模式说明

### 执行模式

1. FrameworkDetector 识别框架与命令（优先级：显式命令 → package.json → 框架特征文件）
2. 使用 background_exec 运行测试命令
3. 收集结果文件
4. 交由 ParserRegistry 解析

### 解析模式

1. 跳过测试执行
2. 直接读取用户指定的结果文件
3. 交由 ParserRegistry 解析

## 支持的框架

| 框架 | 结果格式 | 解析器 | 优先级 |
|------|----------|--------|--------|
| Jest | JSON reporter | JestParser | P0 |
| Vitest | JSON reporter | VitestParser | P0 |
| JUnit XML | XML | JUnitParser | P0 |
| pytest | JSON report | PytestParser | P1 |
| pytest | JUnit XML | JUnitParser（兜底） | P1 |

新增框架：实现 `TestResultParser` 接口（`canHandle` + `parse`）并注册到 `ParserRegistry`。

## 报告结构

报告按固定顺序输出六大章节：

1. **报告头**：项目名、生成时间、执行命令、框架/版本、环境摘要
2. **结果摘要**：总数/通过/失败/跳过、通过率、耗时、✅/❌ 结论
3. **失败用例分析**：用例名、文件、错误信息、堆栈（截断20行）
4. **用例明细**：按文件分组，超200条截断
5. **覆盖率**：语句/分支/函数/行覆盖率 + 低于阈值文件；无则标注「未获取」
6. **附录**：原始结果文件路径、工具版本

## 运行方式

```bash
# 验证脚本
npx tsx skills/test-report-skill/test-fixtures/verify.ts

# 解析模式（已有结果文件）
# 在代码中调用 generateFromResultFile()
```

## 文件结构

```
skills/test-report-skill/
├── SKILL.md                          # Skill 入口与 frontmatter
├── types.ts                          # TestResultModel 数据模型
├── orchestrator.ts                   # 编排器 + 落盘 + 摘要
├── security-filter.ts                # NFR3 安全过滤器
├── detectors/
│   └── framework-detector.ts         # FR1.1 框架识别器
├── parsers/
│   ├── registry.ts                   # NFR5 解析器注册表
│   ├── jest-parser.ts                # Jest JSON 解析器
│   ├── vitest-parser.ts              # Vitest JSON 解析器
│   ├── junit-parser.ts              # JUnit XML 解析器（兜底）
│   └── pytest-parser.ts             # pytest JSON report 解析器
├── generators/
│   ├── markdown-generator.ts         # Markdown 生成器（默认）
│   ├── html-generator.ts             # HTML 生成器（M3）
│   └── json-generator.ts             # JSON 伴随产物（M3）
├── test-fixtures/
│   ├── sample-jest.json             # Jest fixture（含失败用例）
│   ├── sample-junit.xml             # JUnit XML fixture
│   ├── corrupted.json                # 损坏文件 fixture
│   └── verify.ts                     # 验证脚本
└── docs/
    ├── USAGE.md                      # 本文档
    └── DEGRADATION.md                # 降级策略文档
```
