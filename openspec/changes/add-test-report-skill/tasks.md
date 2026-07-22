# Tasks: add-test-report-skill

> 所有任务按实施区域分组。checkbox 在 propose 阶段均不勾选，由 `openspec-apply` 执行时标记。

## M1: P0 核心骨架（Jest/Vitest + JUnit XML + Markdown + 双模式）

- [ ] T1.1 创建 Skill 目录结构与 `SKILL.md` frontmatter
  - 路径：`skills/test-report-skill/SKILL.md`
  - 含：name、description、activation mode、触发意图示例（FR4.1）、配置项默认值表（FR4.2）
- [ ] T1.2 定义统一中间数据模型 `TestResultModel`
  - 路径：`skills/test-report-skill/types.ts`（或对应语言文件）
  - 实现 `TestResultModel` 接口与 `header/summary/failures/details/coverage/appendix` 各字段
- [ ] T1.3 实现解析器插件接口与注册表
  - 路径：`skills/test-report-skill/parsers/registry.ts`
  - 实现 `TestResultParser` 接口（`canHandle` + `parse`）
  - 实现 `ParserRegistry.register()` 与 `detectAndParse()`（静态注册，NFR5）
- [ ] T1.4 实现 Jest JSON 解析器
  - 路径：`skills/test-report-skill/parsers/jest-parser.ts`
  - 解析 Jest JSON reporter 输出 → `TestResultModel`
  - 处理 Jest 特有字段：`numPassedTests`、`numFailedTests`、`testResults[].assertionResults[]`
- [ ] T1.5 实现 Vitest JSON 解析器
  - 路径：`skills/test-report-skill/parsers/vitest-parser.ts`
  - 解析 Vitest JSON reporter 输出 → `TestResultModel`
  - 注意 Vitest 与 Jest JSON 结构差异点
- [ ] T1.6 实现 JUnit XML 解析器（跨语言兜底）
  - 路径：`skills/test-report-skill/parsers/junit-parser.ts`
  - 解析 JUnit XML（`<testsuite>` / `<testcase>` / `<failure>`）→ `TestResultModel`
  - 支持 JUnit XML 作为通用兜底格式
- [ ] T1.7 实现框架/命令识别器
  - 路径：`skills/test-report-skill/detectors/framework-detector.ts`
  - 按优先级（FR1.1）：用户显式命令 → `package.json` scripts.test → `pyproject.toml` → 框架特征文件（`jest.config.*`/`vitest.config.*`/`pytest.ini`）
  - 识别失败返回明确诊断信息（FR1.4）
- [ ] T1.8 实现执行模式与解析模式入口
  - 路径：`skills/test-report-skill/orchestrator.ts`
  - 执行模式：触发测试运行（`run_in_background`）→ 收集结果文件路径
  - 解析模式：检测 `result_file` 参数 → 跳过执行，直接解析
  - 命令无法运行时返回诊断信息，不得生成空报告（FR1.4 / AC4）
- [ ] T1.9 实现安全过滤器
  - 路径：`skills/test-report-skill/security-filter.ts`
  - 过滤环境变量模式、密钥模式、敏感路径（design.md D3）
  - 在报告生成前强制运行
- [ ] T1.10 实现 Markdown 报告生成器
  - 路径：`skills/test-report-skill/generators/markdown-generator.ts`
  - 输出标准六大章节（FR2.1~FR2.6），顺序固定
  - 失败用例堆栈截断至 20 行（FR2.3）
  - 用例明细超 200 条截断并注明（FR2.4）
  - 确定性渲染，仅 `generatedAt` 可变（NFR4）
- [ ] T1.11 实现落盘与返回摘要
  - 默认路径 `reports/test-report-<YYYYMMDD-HHmmss>.md`（FR3.2）
  - 返回报告路径 + 通过率 + 失败数 + 1~3 条关键失败原因（FR3.3）
- [ ] T1.12 将 `reports/` 加入 `.gitignore`

## 验证任务（M1）

- [ ] T1-V1 验证 Jest 解析：用 Jest 项目执行「生成测试报告」，产出 Markdown 报告，摘要数据与 Jest 原始输出一致（AC1）
- [ ] T1-V2 验证失败用例分析：构造含失败用例的结果，报告失败章节含用例名、文件路径、错误信息（AC2）
- [ ] T1-V3 验证解析模式：提供 JUnit XML 文件走解析模式，不触发测试执行即产出报告（AC3）
- [ ] T1-V4 验证损坏文件：结果文件损坏时返回明确错误说明，不生成空报告（AC4）
- [ ] T1-V5 验证幂等性：同一结果文件多次生成报告，非时间戳内容一致（NFR4）

## M2: P1 扩展（pytest + 覆盖率 + fail_threshold）

- [ ] T2.1 实现 pytest 解析器
  - 路径：`skills/test-report-skill/parsers/pytest-parser.ts`
  - 支持 pytest JUnit XML 与 JSON report 两种格式
- [ ] T2.2 实现覆盖率解析与展示
  - 解析 coverage JSON（Jest `coverage` 目录 / coverage-final.json）
  - 报告覆盖率章节：语句/分支/函数/行覆盖率总表 + 低于阈值文件清单（FR2.5）
  - 覆盖率不存在时标注「未获取」，其余章节正常（AC5）
- [ ] T2.3 实现 `fail_threshold` 配置项
  - 通过率低于阈值时报告结论附加「未达标」标记（FR2.2）
- [ ] T2.4 实现 `coverage` 配置项（auto / on / off）

## 验证任务（M2）

- [ ] T2-V1 验证 pytest 解析正确性
- [ ] T2-V2 验证覆盖率数据存在时正确呈现，不存在时标注「未获取」（AC5）

## M3: P1 输出格式扩展（HTML + JSON）

- [ ] T3.1 实现 HTML 报告生成器
  - 路径：`skills/test-report-skill/generators/html-generator.ts`
  - 同样消费 `TestResultModel`，输出六大章节的 HTML
- [ ] T3.2 实现 JSON 伴随产物输出
  - 路径：`skills/test-report-skill/generators/json-generator.ts`
  - 输出结构化的 `TestResultModel` JSON（可选伴随产物）

## 验证任务（M3）

- [ ] T3-V1 验证 HTML 输出结构与 Markdown 一致
- [ ] T3-V2 验证 JSON 产物可被下游程序解析

## 文档与收尾

- [ ] T4.1 编写 Skill 使用文档（含触发意图、配置项、双模式说明）
- [ ] T4.2 补充各解析器的边界条件说明（NFR2 降级策略文档化）
