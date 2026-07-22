# Design: add-test-report-skill

## Overview

本变更新增一个 Skill（`test-report-skill`），核心是「框架解析器插件式结构 + 统一中间数据模型 + 报告生成器」。设计目标是让新增框架支持（NFR5）不影响既有解析器，且报告生成具有确定性（NFR4）与安全性（NFR3）。

该 Skill 解决的工程痛点：测试结果散落在终端输出、CI 日志或框架原生产物（如 JUnit XML、coverage 目录）中，缺乏统一格式与可追溯性。通过本设计，Agent 执行测试后可自动完成「收集 → 解析 → 生成报告」全链路，消除人工整理成本。

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Skill 入口 (SKILL.md)               │
│  触发意图识别 → 模式判定(执行/解析) → 配置合并          │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
      ┌────────▼────────┐   ┌────────▼─────────┐
      │  执行模式         │   │  解析模式          │
      │  (Execution)      │   │  (Parse-only)     │
      │  框架识别器        │   │  直接读取 result_file│
      │  → 触发测试运行    │   │                   │
      │  → 收集结果文件    │   │                   │
      └────────┬─────────┘   └────────┬──────────┘
               │                      │
               └──────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  解析器注册表           │
              │  (ParserRegistry)      │
              │  jest/vitest/junit/    │
              │  pytest(插件)          │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  TestResultModel      │  ← 统一中间数据模型
              │  (统一中间数据模型)    │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  安全过滤器 (Security) │  ← NFR3 凭据过滤
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  报告生成器             │
              │  (ReportGenerator)     │
              │  markdown/html/json    │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  落盘 + 返回摘要        │  ← FR3.2 / FR3.3
              │  reports/test-report-*│
              └───────────────────────┘
```

### 模块职责说明

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| SKILL.md 入口 | 意图识别、模式判定、配置合并 | 用户自然语言 + 配置项 | 执行意图或解析意图 |
| 框架识别器 (Detector) | 探测项目测试框架与运行命令 | 项目配置文件、特征文件 | test_command 字符串或诊断错误 |
| 解析器注册表 (Registry) | 格式探测与分发 | 结果文件路径 + 内容 | TestResultModel |
| 安全过滤器 (SecurityFilter) | 凭据/密钥/路径脱敏 | TestResultModel | 过滤后的 TestResultModel |
| 报告生成器 (Generator) | 渲染标准六大章节 | TestResultModel + 模板 | Markdown/HTML/JSON 字符串 |
| 落盘模块 (Persister) | 写文件 + 返回摘要 | 报告字符串 + output_path | 文件路径 + 摘要文本 |

## Data Model: TestResultModel

所有解析器输出统一的 `TestResultModel`，报告生成器只消费此模型，不直接接触框架原生格式。这确保了「解析器扩展」与「生成器扩展」双向独立。

```typescript
interface TestResultModel {
  header: {
    projectName: string;
    generatedAt: string;        // ISO 8601，报告生成时刻
    executedCommand: string;    // 执行的测试命令或 "parse-only: <file>"
    framework: string;          // "jest" | "vitest" | "pytest" | "junit"
    frameworkVersion?: string;   // 可获取时填充
    environment: {              // 可获取项，缺失标注"未获取"
      os?: string;
      runtime?: string;         // Node/Python 版本
    };
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;           // 百分比，1 位小数
    durationMs: number;         // 总耗时毫秒
  };
  failures: Array<{
    testName: string;
    filePath: string;
    errorMessage: string;
    stackTrace: string[];       // 已截断，默认 20 行
  }>;
  details: Array<{
    filePath: string;
    cases: Array<{
      name: string;
      durationMs: number;
      status: 'passed' | 'failed' | 'skipped';
    }>;
  }>;
  coverage?: {
    statements: number;         // 百分比
    branches: number;
    functions: number;
    lines: number;
    belowThresholdFiles?: string[];
  };                           // 缺失时为 undefined，报告标注"未获取"
  appendix: {
    sourceResultFile: string;
    toolVersion: string;        // Skill 版本
  };
}
```

## Parser Plugin Interface

```typescript
interface TestResultParser {
  name: string;                          // "jest" | "vitest" | "junit" | "pytest"
  canHandle(filePath: string, content?: string): boolean;  // 格式探测
  parse(raw: string | Buffer): TestResultModel;            // 解析为统一模型
}

// 注册表：静态注册，新增框架不影响既有解析器（NFR5）
class ParserRegistry {
  private parsers: TestResultParser[] = [];
  register(parser: TestResultParser): void { /* ... */ }
  detectAndParse(filePath: string): TestResultModel { /* ... */ }
}
```

### 框架原生字段 → TestResultModel 映射

每个解析器负责将框架特有的字段名映射到统一模型。映射规则如下：

#### Jest JSON 映射

| Jest 原生字段 | TestResultModel 字段 | 说明 |
|--------------|---------------------|------|
| `numTotalTests` | `summary.total` | 直接映射 |
| `numPassedTests` | `summary.passed` | 直接映射 |
| `numFailedTests` | `summary.failed` | 直接映射 |
| `numPendingTests` + `numTodoTests` | `summary.skipped` | 两者求和 |
| `testResults[].perfStats.runtime` | `summary.durationMs` | 取首个 testResult 或求和 |
| `testResults[].name` | `details[].filePath` | 测试文件路径 |
| `assertionResults[].title` | `details[].cases[].name` | 用例名 |
| `assertionResults[].status === 'failed'` | `failures[]` | 失败用例提取 |
| `assertionResults[].failureMessages` | `failures[].errorMessage` | 合并错误信息 |
| `coverageMap`（若存在） | `coverage` | 需额外解析 coverage JSON |

#### Vitest JSON 映射

| Vitest 原生字段 | TestResultModel 字段 | 说明 |
|----------------|---------------------|------|
| `numTotalTests` | `summary.total` | 与 Jest 结构相似但有差异 |
| `numPassedTests` | `summary.passed` | 直接映射 |
| `numFailedTests` | `summary.failed` | 直接映射 |
| `numPendingTests` | `summary.skipped` | 直接映射 |
| `testResults[].perfStats.runtime` | `summary.durationMs` | 同 Jest |
| `testResults[].name` | `details[].filePath` | 同 Jest |
| `assertionResults[].title` | `details[].cases[].name` | 同 Jest |
| Vitest 特有的 `result.errors` | `failures[].errorMessage` | 错误结构略有不同 |

注意：Vitest 的 JSON reporter 输出与 Jest 高度相似但非完全一致，解析器须独立实现而非复用 Jest 解析器。

#### JUnit XML 映射

| JUnit XML 字段 | TestResultModel 字段 | 说明 |
|---------------|---------------------|------|
| `<testsuite tests="N">` | `summary.total` | 属性值 |
| `<testsuite failures="N">` | `summary.failed` | 属性值 |
| `<testsuite skipped="N">` | `summary.skipped` | 属性值 |
| `passed = total - failed - skipped` | `summary.passed` | 计算得出 |
| `<testsuite time="T">` | `summary.durationMs` | 秒转毫秒 `T * 1000` |
| `<testcase classname="..."` | `details[].filePath` | classname 通常含文件路径 |
| `<testcase name="..."` | `details[].cases[].name` | 用例名 |
| `<failure message="...">` | `failures[].errorMessage` | 失败信息 |
| `<failure>` 内部文本 | `failures[].stackTrace` | 堆栈文本，截断至 20 行 |

## Key Design Decisions

### D1: 统一中间数据模型
解析器与生成器解耦。新增框架只需实现 `parse() -> TestResultModel`；新增输出格式只需消费 `TestResultModel`。双向扩展互不影响。这是整个 Skill 架构的核心契约：任何解析器产出必须符合此接口，任何生成器只依赖此接口。

### D2: 插件式解析器 + 静态注册
`ParserRegistry` 按 `canHandle()` 返回值探测格式。P0 内置 jest/vitest/junit 三个解析器；P1 追加 pytest。注册为静态列表（非运行时热插拔），满足 NFR5 且避免动态加载安全风险。探测顺序按注册顺序，首个 `canHandle()` 返回 `true` 的解析器胜出。

### D3: 安全过滤器独立于解析器
`SecurityFilter` 在 `TestResultModel` 产出后、报告生成前统一运行，过滤：
- 环境变量模式：`process.env.*`、`$ENV_*`；
- 密钥模式：`password=...`、`token=...`、`Bearer ...`、`AKIA[0-9A-Z]{16}` 等；
- 敏感路径：`$HOME`、`/Users/<name>`、`C:\Users\<name>` 替换为 `<redacted>`。
此设计确保即使解析器遗漏，安全过滤仍兜底（NFR3）。过滤器为纯函数，无副作用，易于测试。

### D4: 执行模式与 Agent 后台任务解耦
测试执行可能耗时极长（R2）。Skill 层仅发出执行意图（`run_in_background=true`），依赖 Agent 运行时的 `background_exec` 能力运行测试命令并轮询结果文件。Skill 不自建进程管理，避免与运行时冲突。具体流程：发出 `run_in_background` → `background_exec.wait` 轮询 → 检测结果文件生成 → 交由解析器。

### D5: 确定性报告生成（NFR4）
报告生成器输入为 `TestResultModel` + 固定模板。唯一可变字段为 `generatedAt`（时间戳）。模板渲染不依赖随机数、不依赖执行顺序，保证同一输入多次渲染内容一致（时间戳除外）。数组排序须使用稳定排序键（如按文件路径字母序），不依赖解析顺序。

### D6: 降级输出策略（NFR2）
解析器遇异常字段时：
- 可选字段缺失（如 `frameworkVersion`）：填 `undefined`，报告标注「未获取」；
- 必选字段缺失（如 `total`）：解析失败，抛出明确错误，Skill 返回诊断信息而非空报告（AC4）；
- 部分用例字段缺失：该用例降级展示，缺失项标注「未获取」，不阻断整体报告。
字段分为「必选」与「可选」两级，解析器实现须明确标注每个字段属于哪一级。

### D7: 配置合并优先级
配置项合并顺序（高优先级覆盖低优先级）：
1. 用户在本次调用中显式传入的参数（最高）；
2. Skill 默认值（最低）。
中间不引入额外配置层。这保证配置来源单一可追溯，避免「配置文件覆盖默认值又被参数覆盖」的多层困惑。

## Report Template Structure

Markdown 报告生成器按以下固定顺序渲染六大章节。每个章节对应 `TestResultModel` 的一个字段组：

```
# 测试报告 - {projectName}

> 生成时间: {generatedAt}
> 执行命令: {executedCommand}
> 框架: {framework} {frameworkVersion}
> 环境: {os} / {runtime}

## 结果摘要

| 指标 | 值 |
|------|-----|
| 用例总数 | {total} |
| 通过 | {passed} ✅ |
| 失败 | {failed} ❌ |
| 跳过 | {skipped} |
| 通过率 | {passRate}% |
| 总耗时 | {durationMs}ms |

**结论: {✅ 全部通过 | ❌ 存在失败}{未达标标记}**

## 失败用例分析

### 1. {testName}
- **文件**: `{filePath}`
- **错误**: {errorMessage}
- **堆栈**:
  ```
  {stackTrace[0]}
  {stackTrace[1]}
  ...（截断至 20 行）
  ```

## 用例明细

<details>
<summary>{filePath} ({N} cases)</summary>

| 用例 | 耗时 | 状态 |
|------|------|------|
| {name} | {durationMs}ms | ✅/❌/⏭️ |

</details>
（超过 200 条时截断并注明）

## 覆盖率

| 类型 | 覆盖率 |
|------|--------|
| 语句 | {statements}% |
| 分支 | {branches}% |
| 函数 | {functions}% |
| 行 | {lines}% |

低于阈值文件: {belowThresholdFiles}

（覆盖率不存在时显示「未获取」）

## 附录

- 原始结果文件: `{sourceResultFile}`
- 生成工具版本: {toolVersion}
```

## Error Handling Flow

```
用户触发
    │
    ▼
模式判定 ──→ 解析模式 ──→ 读取 result_file
    │                              │
    ▼                              ▼
执行模式 ──→ 框架识别         文件存在?
    │            │                 │
    │            ▼                 否 → 返回明确错误(AC4)
    │     识别成功?                是 → ParserRegistry.detectAndParse
    │            │                       │
    │           否 → 返回诊断(FR1.4)      ▼
    │                                  解析成功?
    ▼                                    │
触发测试运行(background)                  是 → SecurityFilter → Generator → 落盘
    │                                     │
    ▼                                    否 → 返回格式错误说明(AC4)
运行成功?
    │
   否 → 返回执行诊断(FR1.4)
    │
   是 → 收集结果文件 → ParserRegistry.detectAndParse → ...
```

核心原则：任何环节失败都须返回明确的错误说明，不得生成空报告冒充成功（FR1.4 / AC4）。

## Security Considerations

- **凭据过滤**：D3 安全过滤器为强制环节，任何报告生成前必经此过滤；
- **路径脱敏**：堆栈中的绝对路径过滤用户家目录，防止泄露开发者身份/机器信息；
- **不写密钥到报告**：执行命令中若包含 token，报告头 `executedCommand` 须脱敏（如 `npm test --token=***`）。
- **执行命令脱敏**：`executedCommand` 字段在写入报告前，须经过与堆栈相同的安全过滤规则，确保命令行参数中的密钥不泄露。
- **覆盖率路径**：`belowThresholdFiles` 中的文件路径须为相对路径（相对项目根），不含绝对路径或用户名。

## Performance Considerations

- **NFR1 约束**：解析与报告生成（不含测试执行）在 1000 用例规模下须 5 秒内完成；
- **解析器性能**：JSON/XML 解析使用流式或增量解析，避免将整个结果文件载入内存后再处理；
- **截断策略**：用例明细超 200 条时截断，既控制报告体积又保证可读性；
- **堆栈截断**：堆栈默认截断至 20 行，避免超长堆栈拖慢渲染与阅读；
- **确定性排序**：用例按文件路径字母序稳定排序，不依赖解析顺序，保证幂等且渲染可预测。

## Testing Strategy

- **解析器单测**：每个解析器针对框架典型输出构造 fixture，验证字段映射正确性；
- **安全过滤器单测**：构造含凭据/密钥/敏感路径的输入，验证过滤后无泄露；
- **生成器单测**：给定固定 `TestResultModel`，验证输出内容确定性（NFR4）；
- **集成测试**：对应 AC1~AC5 五条验收标准，各写一条端到端测试：
  - AC1: Jest 项目执行 → Markdown 报告结构完整，摘要数据一致；
  - AC2: 含失败用例 → 失败分析章节含用例名、文件路径、错误信息；
  - AC3: JUnit XML 走解析模式 → 不触发执行即产出报告；
  - AC4: 损坏文件 → 返回明确错误而非空报告；
  - AC5: 无覆盖率 → 标注「未获取」，其余章节正常。
- **降级测试**：构造缺失可选字段的结果文件，验证降级输出正确（NFR2）。

## Migration / Compatibility

- 纯新增 Skill，无数据迁移；
- 不修改现有 `src/` 业务代码，无兼容性风险；
- `reports/` 目录须加入 `.gitignore`（避免报告文件污染版本库）。
- 若项目已存在 `reports/` 目录用于其他用途，Skill 的输出路径可通过 `output_path` 配置项避开冲突。

## Open Design Questions

以下设计问题在实现阶段可进一步细化，但不阻塞 propose 阶段：

- **QD1**：Vitest 与 Jest JSON 结构差异的具体字段清单，需在实现时对比真实输出确认（已在映射表中标注「须独立实现」）；
- **QD2**：pytest JUnit XML 与通用 JUnit XML 解析器是否可复用，取决于 pytest JUnit XML 是否有扩展属性（实现时验证）；
- **QD3**：HTML 生成器（M3）是否复用 Markdown 转 HTML 还是从模型独立渲染，取决于样式需求复杂度。
