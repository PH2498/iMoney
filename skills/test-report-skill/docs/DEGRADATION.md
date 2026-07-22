# 降级策略文档（NFR2 健壮性）

## 设计原则

解析器遇异常字段时遵循「必选校验、可选降级」策略（设计决策 D6）：

| 字段级别 | 缺失处理 | 对应 AC |
|----------|----------|---------|
| 必选字段（如 `total`） | 解析失败，抛出明确错误，返回诊断信息 | AC4 |
| 可选字段（如 `frameworkVersion`） | 填 `undefined`，报告标注「未获取」 | NFR2 |
| 部分用例字段缺失 | 该用例降级展示，不阻断整体报告 | NFR2 |

## 各解析器边界条件

### JestParser

| 场景 | 处理方式 |
|------|----------|
| `numTotalTests` 缺失 | 抛错：缺少必选字段 numTotalTests（AC4） |
| `numPassedTests` 缺失 | 抛错：缺少必选字段 numPassedTests（AC4） |
| `numFailedTests` 缺失 | 抛错：缺少必选字段 numFailedTests（AC4） |
| `numPendingTests` / `numTodoTests` 缺失 | 默认 0，skipped = pending + todo |
| `testResults[].perfStats.runtime` 缺失 | 默认 0，durationMs 求和时跳过 |
| `assertionResults[].title` 缺失 | 用 `fullName` 或 `<未命名用例>` |
| `assertionResults[].duration` 缺失 | 默认 0 |
| `failureMessages` 为空数组 | 不加入 failures 列表 |
| `coverageMap` 缺失 | coverage = undefined，报告标注「未获取」 |
| `frameworkVersion` 缺失 | 报告头标注「未获取」 |
| JSON 非法格式 | 抛错：结果文件不是合法 JSON（AC4） |

### VitestParser

| 场景 | 处理方式 |
|------|----------|
| 必选字段缺失 | 同 JestParser，抛错（AC4） |
| `assertionResults[].errors` 缺失 | 不提取失败用例（降级） |
| `testResults[].errors` 存在 | 按 testResult 级别错误提取（Vitest 特有） |
| `runtime` / `duration` 缺失 | 默认 0 |
| `startTime` 缺失 | 不影响解析 |

### JUnitParser

| 场景 | 处理方式 |
|------|----------|
| 无 `<testsuite>` 元素 | 抛错：未包含任何 testsuite 元素（AC4） |
| `tests` 属性缺失 | 按 testcase 计数兜底 |
| `failures` 属性缺失 | 默认 0，按 `<failure>` 子元素计数 |
| `skipped` 属性缺失 | 默认 0，按 `<skipped>` 子元素检测 |
| `time` 属性缺失 | 默认 0 |
| `classname` 缺失 | 用 `<未知类>` |
| `name` 缺失 | 用 `<未命名用例>` |
| `<failure>` message 属性缺失 | 用内部文本或「未获取到错误信息」 |
| `<failure>` 内部文本为空 | stackTrace 为空数组 |
| 文件为空 | orchestrator 返回明确错误（AC4） |
| 非法 XML 结构 | 正则提取能匹配的部分，无法匹配则抛错 |

### PytestParser

| 场景 | 处理方式 |
|------|----------|
| `summary` 字段缺失 | 抛错：缺少必选字段 summary（AC4） |
| `summary.total` 缺失 | 抛错：缺少必选字段 summary.total（AC4） |
| `summary.passed` 缺失 | 默认 0 |
| `summary.skipped` / `xfailed` / `xpassed` | skipped 求和 |
| `tests` 数组缺失 | details 为空，按 summary 统计 |
| `test.nodeid` 缺失 | 用 `<未命名用例>` |
| `test.call.crash.message` 缺失 | 用 longrepr 或「未获取到错误信息」 |
| `test.call.longrepr` 缺失 | stackTrace 为空 |
| JSON 非法格式 | 抛错（AC4） |

## 覆盖率降级（T2.2）

| 场景 | 处理方式 |
|------|----------|
| `coverage` 配置为 `off` | 跳过覆盖率解析，章节标注「未获取」 |
| `coverage` 配置为 `auto` 且无 coverage 文件 | coverage = undefined，标注「未获取」（AC5） |
| `coverage` 配置为 `on` 且无 coverage 文件 | coverage = undefined，标注「未获取」 |
| coverage-final.json 存在但解析失败 | coverage = undefined，标注「未获取」 |
| 覆盖率数据部分缺失 | 按已有数据计算，缺失项百分比默认 0 |

## 安全过滤降级（NFR3）

安全过滤器为纯函数，不抛异常。所有匹配模式的敏感内容被替换为 `<redacted>`：
- 无法匹配的文本原样输出
- 空字符串原样返回空

## 核心原则

**任何环节失败都须返回明确的错误说明，不得生成空报告冒充成功（FR1.4 / AC4）。**
