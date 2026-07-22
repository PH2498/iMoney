# Proposal: add-test-report-skill

## Intent

提供一个可复用的 Skill，使 Agent 在执行测试后能够自动解析测试结果并生成结构化、可读性强的标准测试报告。目标是消除当前测试结果散落在终端输出、CI 日志或框架原生产物（如 JUnit XML、coverage 目录）中的痛点，实现「一条指令完成：执行测试 → 收集结果 → 生成报告」。

核心交付价值：
- 一条指令自动完成测试执行、结果收集、报告生成全链路；
- 报告内容标准化，包含报告头、结果摘要、失败用例分析、用例明细、覆盖率、附录六大板块；
- 支持主流测试框架结果解析（Jest / Vitest / pytest / JUnit XML 兜底）；
- 报告默认输出 Markdown，支持执行/解析双模式。

## Scope

### P0（首期必做 — M1）
- Jest / Vitest JSON 结果解析；
- JUnit XML 解析（作为跨语言兜底格式）；
- Markdown 报告生成，含标准六大板块；
- 执行模式（触发测试运行并收集结果）与解析模式（跳过执行，直接解析已有结果文件）双模式；
- FR1.1 框架/运行命令自动识别（用户显式命令 → 项目配置 → 框架特征文件推断）；
- FR1.4 测试命令无法运行时给出明确诊断信息，不得生成空报告冒充成功。

### P1（M2 / M3）
- pytest 支持（JUnit XML / JSON report）；
- 覆盖率章节（语句 / 分支 / 函数 / 行覆盖率总表 + 低于阈值文件清单）；
- `fail_threshold` 配置项（通过率低于该值时报告结论标记为不达标）；
- HTML 输出格式；
- JSON 伴随产物（结构化数据）。

### P2（后续迭代，本期不做）
- 多次运行结果的历史趋势对比分析；
- 更多框架支持（Go test / cargo test）。

## Non-Goals（本期明确不做）

- 不做测试用例的自动生成或修复（仅报告，不改测试代码）；
- 不做报告的在线托管 / Web 服务化展示；
- 不做多次运行结果的趋势对比分析（列为后续迭代候选）；
- 不做非测试类质量报告（如 lint、安全扫描）的聚合；
- 不做报告自动推送到 IM / 邮件等渠道（开放问题 Q3 已确认列为非目标）。

## Affected Areas

本变更新增一个 Skill（`test-report-skill`），不修改现有业务源码。受影响区域：

| 区域 | 影响 | 说明 |
|------|------|------|
| `skills/test-report-skill/` | 新增 | Skill 主体：SKILL.md + 解析器插件 + 报告生成器 + 框架识别器 |
| `skills/test-report-skill/parsers/` | 新增 | 插件式解析器：jest-parser、vitest-parser、junit-parser、pytest-parser |
| `skills/test-report-skill/generators/` | 新增 | 报告生成器：markdown-generator（P0）、html-generator（P1）、json-generator（P1） |
| `skills/test-report-skill/detectors/` | 新增 | 框架/命令识别器 |
| `reports/` | 新增（运行时） | 报告默认输出目录，gitignore |
| 现有业务源码 `src/` | 不受影响 | 无改动 |

## Risk

- **R1 框架 reporter 输出差异大**：各框架 JSON/JUnit XML 字段命名、结构差异显著，解析层需良好抽象。缓解：NFR5 插件式设计，每个框架独立解析器，共享统一中间数据模型（TestResultModel）。
- **R2 测试执行耗时不可控**：长任务可能阻塞 Agent 会话。缓解：执行模式交由 Agent 运行时后台执行并轮询（依赖 Agent 的 background_exec 能力），Skill 层仅发出执行意图并等待结果文件。
- **R3 结果文件格式异常 / 字段缺失**：第三方或自定义 reporter 可能产出非标准字段。缓解：NFR2 降级输出，缺失项标注「未获取」，不得崩溃或静默丢数据。
- **R4 敏感信息泄露**：错误堆栈、环境信息可能包含凭据、密钥。缓解：NFR3 安全过滤，报告中不得泄露环境变量、密钥；堆栈须过滤敏感路径外凭据。
- **R5 幂等性**：同一结果文件多次生成报告，内容须一致（时间戳除外）。缓解：NFR4 报告生成确定性逻辑，时间戳为唯一可变字段。

## Rollout / Rollback

### Rollout
1. 将 Skill 目录 `skills/test-report-skill/` 合入主分支；
2. 用户通过「生成测试报告」触发意图或指定结果文件路径即可使用，无需额外安装步骤（Skill 随 Agent 会话加载）；
3. P0 框架（Jest / Vitest / JUnit XML）优先可用，P1 框架后续迭代补充。

### Rollback
- 删除 `skills/test-report-skill/` 目录即可完全回滚，不影响业务代码；
- 已生成的报告文件位于 `reports/`，可手动清理，不影响系统状态。
