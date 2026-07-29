# 框架适配说明

本文件说明各测试框架如何配置 reporter 以输出 test-report-generator 可解析的结果文件，以及执行模式下的命令约定。

## 1. Jest

### 执行命令（执行模式）

```
npx jest --json --outputFile=test-results.json
```

`--json` 使 Jest 输出 JSON 结构结果，`--outputFile` 落盘到指定文件。

### 覆盖率

配合 `--coverage` 选项，Jest 会在 `coverage/coverage-summary.json` 生成覆盖率汇总，test-report-generator 会自动读取该文件填充覆盖率章节。

```
npx jest --json --outputFile=test-results.json --coverage
```

### 结果文件字段（JSON reporter）

- 顶层：`numTotalTests`、`numPassedTests`、`numFailedTests`、`numPendingTests`、`numTodoTests`、`startTime`、`success`
- `testResults[]`：每个测试文件一项，含 `name`（文件路径）、`status`、`startTime`、`endTime`
- `assertionResults[]`：每条用例，含 `title`、`status`、`duration`、`failureMessages`、`ancestorTitles`

## 2. Vitest

### 执行命令（执行模式）

```
npx vitest run --reporter=json --outputFile=test-results.json
```

`--reporter=json` 启用 JSON reporter，`--outputFile` 落盘。

> 注意：Vitest 需使用 `run` 模式（非 watch）以保证 CI/Agent 执行后退出。

### 覆盖率

```
npx vitest run --reporter=json --outputFile=test-results.json --coverage
```

Vitest 覆盖率产物同样输出到 `coverage/coverage-summary.json`（需安装 `@vitest/coverage-v8` 或 `@vitest/coverage-istanbul`）。

### 结果文件差异

- 结构与 Jest 类似，但失败信息可能出现在断言的 `errors[]` 字段（含 `message` 与 `stack`）
- Vitest 特征标记：顶层 `name: "vitest"`

## 3. JUnit XML（跨语言兜底）

### 适用场景

- 直接解析 CI 已有的 JUnit XML 产物（满足 US4「仅解析已有结果」模式）
- 任何能输出 JUnit XML 的测试框架均可走此兜底解析器

### 典型命令

| 框架 | 命令 |
| --- | --- |
| pytest | `python -m pytest --junitxml=test-results.xml` |
| Maven Surefire | `mvn test -Dsurefire.useFile=true`（surefire-reports/ 生成 XML） |
| Gradle | `gradle test`（build/test-results/test/ 生成 XML） |

### 结果文件结构（核心）

```xml
<testsuites tests="3" failures="1" errors="0" skipped="0" time="1.23">
  <testsuite name="example.test.ts" tests="3" failures="1" errors="0" skipped="0" time="1.23" file="example.test.ts">
    <testcase name="should pass" classname="example" time="0.4">
    </testcase>
    <testcase name="should fail" classname="example" time="0.3">
      <failure message="Expected 2 but got 1" type="AssertionError">堆栈文本</failure>
    </testcase>
    <testcase name="should skip" classname="example" time="0.0">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>
```

## 4. 双模式说明

| 模式 | 触发条件 | 行为 |
| --- | --- | --- |
| 解析模式 | 提供 `--resultFile` 且未指定 `--execute` | 跳过执行，直接解析已有结果文件 |
| 执行模式 | 指定 `--execute`，或提供 `--command` 但无 `--resultFile` | 自动识别框架 -> 执行测试 -> 落盘结果 -> 解析 -> 生成报告 |

## 5. 诊断与降级

- **框架无法识别**（FR1.4）：执行模式下若未识别到 jest/vitest/pytest 且未显式指定命令，抛出明确错误，不生成空报告。
- **命令无法运行**（FR1.4）：命令退出且未生成结果文件时，抛出诊断错误，不冒充成功。
- **结果文件损坏**（AC4）：解析失败时返回明确错误说明，而非空报告。
- **字段缺失**（NFR2）：降级输出，缺失项标注「未获取」，不崩溃。
- **覆盖率缺失**（AC5）：标注「覆盖率数据未获取」，其余章节正常。
