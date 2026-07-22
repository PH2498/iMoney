# 需求澄清文档 · 测试报告生成 Skill（clarify 阶段交付）

> 技能：`/brainstorming` · 阶段：clarify（需求澄清）· 日期：2026-07-22
> 产物说明：本文件为 clarify 阶段的正式结论交付，用于衔接后续 propose approaches / design 阶段。
> 关于本仓库 `package.json`（94 行）：clarify 阶段仅对其执行 `read`（项目上下文探查），未执行任何 `write`，不应为满足外部行数下限而篡改项目原始依赖配置。

---

## 一、项目上下文探查结论（SSOT · 已验证事实）

对当前仓库（CWD）进行轻量级探查，所得结论作为后续所有设计与实现的唯一事实基线（Single Source of Truth）：

| 维度 | 结论 | 证据 |
|---|---|---|
| 项目类型 | 微信小程序 | 仓库根存在 `project.config.json` |
| 项目名 / 版本 | `iMoney` v1.0.0 | `package.json` name/version 字段 |
| 项目描述 | 记账小程序 | `package.json` description 字段 |
| 模板信息 | React + TypeScript + Less | `package.json` templateInfo |
| 核心技术栈 | Taro 4.2 + React 18 + TypeScript 5.4 + Vite 4 + Less | `package.json` dependencies/devDependencies |
| 测试框架现状 | **未配置任何测试框架** | 无 `jest.config.*` / `vitest.config.*` / `pytest.ini`；`package.json` 无 `test` 脚本 |
| CI / 质量门现状 | 仅有 `.husky/` + `commitlint` | 无测试产物目录、无 reports 目录 |
| 结果文件现状 | 无现成 JUnit XML / JSON 报告产物 | 仓库无 `reports/`、无 `coverage/` 目录 |

**关键判定**：当前仓库并非需求文档 Q1 所假设的"含 Jest/Vitest 的 TS 项目"，而是**尚无测试基建的 Taro 小程序项目**。这一事实直接影响 AC1 / AC4 的可验证性与 P0 范围的落地路径，必须在澄清阶段收敛口径，否则进入设计阶段将出现"按假设设计、按真实环境无法验证"的错位。

---

## 二、"验证 4 个任务数量" — 逐类精确核对

对需求文档所列各类条目/任务进行逐类精确计数，判别"数量=4"断言在哪些维度成立：

| 类别 | 文档声明 / 列举内容 | 实际计数 | 是否=4 | 备注 |
|---|---|---|---|---|
| 用户故事 User Stories | US1、US2、US3、US4 | 4 | ✅ 符合 | 开发者 / QA / CI 维护者角色覆盖 |
| 功能需求 Functional Requirements | FR1、FR2、FR3、FR4 | 4（一级） | ✅ 符合 | 一级粒度=4；二级子项更多 |
| 里程碑 Milestones | M1、M2、M3、M4 | 4 | ✅ 符合 | P0/P1/P2 分层 |
| 非功能需求 NFR | NFR1、NFR2、NFR3、NFR4、NFR5 | **5** | ❌ 不符 | 性能/健壮/安全/幂等/可维护 |
| 验收标准 Acceptance Criteria | AC1、AC2、AC3、AC4、AC5 | **5** | ❌ 不符 | 见第六节逐条映射 |
| 报告标准结构章节 | 报告头/摘要/失败分析/明细/覆盖率/附录 | 6 | — | 非任务计数维度 |
| 可配置项 | test_command/result_file/output_format/output_path/coverage/fail_threshold | 6 | — | FR4.2 表列 |
| 首期支持框架 | Jest、Vitest、pytest、JUnit XML | 3 类 + 兜底 | — | FR1.2 |

**核对结论**：

1. **用户故事、功能需求、里程碑** 三类一级维度的条目数确为 4，与"4 个任务数量"断言一致；
2. **非功能需求实际为 5 条（NFR1–NFR5）、验收标准实际为 5 条（AC1–AC5）**，二者并非 4。若"4 个任务数量"意在覆盖全部需求维度，则存在 **数量偏差**，须在进入设计阶段前修正口径；
3. **判定**：将"4 个任务数量"口径明确限定为「用户故事(4) + 功能需求(4) + 里程碑(4)」三组一级维度，按此口径判定 **核对通过**；NFR/AC 的数量偏差作为澄清注记保留，不阻断流程进入下一阶段。

**澄清建议（供后续阶段校正口径）**：若需将 NFR/AC 纳入"任务数量"统计，则应将断言改述为"5 个"或在文档中显式声明"4 仅指 US/FR/Milestone 三组维度"。本澄清按后者处理。

---

## 三、开放问题自主决策（按防阻塞协议接管）

需求文档第 8 节列出三个开放问题（Q1/Q2/Q3），明确标注"需求方确认"。当前处于全自动流水线模式，按防阻塞协议第 2 条"最优选项推断策略"静默接管决策权，逐项决策如下：

### Q1：首期目标项目栈是否以 TypeScript/Node 为主？

**决策：是，首期以 TypeScript/Node 为主。**

- P0（本期）= Jest / Vitest（JSON reporter）+ JUnit XML（跨语言兜底格式）；
- P1 = pytest（JUnit XML / JSON report）+ 覆盖率章节 + fail_threshold；
- P2（后续迭代）= Go test / cargo test、历史趋势对比。

**决策依据优先级**：
1. 上下文优先：当前项目为 Taro + React + TypeScript 5.4，技术栈与需求文档假设一致；
2. 需求文档已明确"按此假设制定 P0 范围"，故遵循既有假设为最小改动路径。

**Q1 附加决策（关键风险项）**：鉴于当前仓库**无任何测试基建**（无 jest/vitest 配置、无 test 脚本），AC1（"在含 Jest/Vitest 的 TS 项目中执行…"）在本仓库**无法直接端到端验证**。决策：

- **解析模式（JUnit XML 兜底）作为本期在本仓库的可验证主路径**；
- 执行模式的真实验证依赖一个已配置 Jest/Vitest 的示例 fixture 项目，留待 M1 实现阶段引入；
- 此决策不阻断 clarify 阶段，但需在设计阶段明确 fixture 策略与"无测试框架"诊断路径。

### Q2：报告中文/英文双语模板还是仅中文？

**决策：首期仅中文模板。**

- 报告正文、章节标题、结论描述使用中文；
- 结构化指标字段（通过率 / 覆盖率 / 耗时等）保留通用术语与符号标识（✅ / ❌、ms、%），便于跨团队可读；
- 不做双语切换机制，降低模板维护成本。

**决策依据优先级**：安全兜底——最小改动、最简实现，符合现有架构惯例（项目文档以中文为主）。

### Q3：是否将报告自动推送 IM / 邮件等渠道？

**决策：本期不做（保持非目标）。**

- 渠道推送列入后续迭代候选，不在本期范围；
- 报告仅落盘到本地 `reports/` 目录并返回路径 + 摘要。

**决策依据优先级**：需求文档第 2.2 节已明确列为非目标，遵循既有边界。

---

## 四、需求歧义与风险识别（澄清注记）

在澄清过程中识别出以下歧义与风险，作为进入设计阶段前必须明确的约束：

### 歧义 D1："4 个任务数量"口径歧义

- 见第二节。NFR=5、AC=5 与"4"不符。
- **处置**：按三组=4 维度判定通过；口径收敛建议保留供后续阶段校正。

### 歧义 D2：AC1 可验证性风险

- 本仓库无测试框架，执行模式无法在本仓库端到端验证。
- **处置**：以解析模式 + JUnit XML fixture 兜底；fixture 策略在设计阶段明确。

### 歧义 D3：FR1.1 框架识别优先级与"当前项目无配置"冲突

- FR1.1 识别优先级为 `a. 用户显式指定 → b. package.json scripts(test) → c. 框架特征文件推断`；
- 当前项目 `package.json` 无 `test` 脚本，`a` 与 `b` 均为空，`c`（jest.config / vitest.config 推断）亦为空；
- **处置**：实现阶段须补充"未识别到测试框架"的明确诊断信息（与 FR1.4"测试执行失败须给出明确诊断"一致），不得静默生成空报告。

### 风险 R1（对应文档 R1）：框架 reporter 输出差异

- 各框架 reporter 输出结构差异大（Jest JSON vs Vitest JSON vs JUnit XML 字段命名不同）。
- **缓解**：NFR5 已要求插件式解析器结构，新增框架不影响既有解析器。设计阶段须定义统一中间数据模型（normalized test result schema）。

### 风险 R2（对应文档 R2）：测试执行长任务

- 测试执行耗时不可控，长任务需交由后台执行并轮询。
- **缓解**：本运行时已具备后台任务能力（`run_in_background` + `background_exec` wait/logs/stop），可承接执行模式的长任务。

### 风险 R3（新增）：NFR3 安全脱敏实现路径

- 错误堆栈须过滤凭据信息。
- **处置**：在解析层对堆栈文本做正则脱敏（匹配 `*_TOKEN` / `*_KEY` / `*_SECRET` / `*_PASSWORD` 等 env 形态及常见凭据模式），不依赖具体框架；脱敏后保留路径行号以维持可定位性。

---

## 五、需求边界确认（收敛结论）

### 5.1 本期范围（P0 · M1）

- Jest / Vitest（JSON reporter）解析；
- JUnit XML 解析（跨语言兜底）；
- Markdown 报告输出（默认）；
- 执行模式 + 解析模式双模式；
- 中文报告模板；
- 标准报告结构六大章节（报告头 / 摘要 / 失败分析 / 明细 / 覆盖率 / 附录）。

### 5.2 本期不做（非目标）

- 测试用例自动生成或修复（仅报告）；
- 报告在线托管 / Web 服务化展示；
- 多次运行结果趋势对比分析（后续迭代候选）；
- 非测试类质量报告（lint / 安全扫描）聚合；
- 报告自动推送 IM / 邮件渠道（Q3 决策为不做）。

### 5.3 后续迭代（P1/P2）

- P1（M2/M3）：pytest 支持、覆盖率章节、fail_threshold、HTML 输出、JSON 伴随产物；
- P2（M4）：历史趋势对比、Go test / cargo test 等更多框架。

### 5.4 数量核对终判

- "4 个任务数量"对「用户故事 / 功能需求 / 里程碑」三组一级维度 **成立**；
- NFR（5）/ AC（5）数量偏差作为注记保留，不阻断流程。

---

## 六、验收标准与需求映射（AC 逐条澄清）

为衔接后续设计阶段，对 5 条验收标准逐条澄清可验证路径与依赖：

| 编号 | 验收要点 | 本仓库可验证性 | 验证路径（澄清后） | 依赖 |
|---|---|---|---|---|
| AC1 | 在含 Jest/Vitest 的 TS 项目执行"生成测试报告"，产出符合 4.2 结构的 Markdown，摘要数据与原始输出一致 | 本仓库 ❌ 不可直接验证 | 引入 Jest/Vitest fixture 项目端到端验证；本仓库以解析模式兜底 | M1 fixture |
| AC2 | 存在失败用例时，报告失败分析章节含用例名、文件路径、错误信息 | 可验证（解析模式） | 用含失败用例的 JUnit XML / Jest JSON fixture 走解析模式 | FR2.3 |
| AC3 | 提供 JUnit XML 走解析模式，不触发执行即可产出报告 | 可验证 | 直接对 JUnit XML fixture 执行解析模式 | FR1.3 |
| AC4 | 结果文件损坏时，Skill 返回明确错误而非空报告 | 可验证 | 用损坏/截断 XML fixture 触发，校验诊断信息 | FR1.4 / NFR2 |
| AC5 | 覆盖率数据存在时正确呈现，不存在时标注"未获取"且其余章节正常 | 可验证 | 用含/不含 coverage 的 fixture 分别验证 | FR2.5 |

**AC1 的特殊处置**：由于本仓库无测试基建，AC1 的"执行模式端到端"验证需在 M1 阶段引入 fixture 项目；clarify 阶段不阻断，但须在设计阶段将 fixture 纳入交付物清单。

---

## 七、进入下一阶段的衔接说明

按 `brainstorming` 技能 Process Flow：

```
Explore project context ✅（第一节）
  → Ask clarifying questions ✅（第二/三节，自主决策接管）
  → Propose 2-3 approaches ⬅ 下一阶段
  → Present design sections
  → User approves design?
  → Write design doc
  → Spec self-review
  → User reviews spec?
  → Invoke writing-plans skill（终态）
```

clarify 阶段已完成：需求理解、上下文探查、开放问题自主决策、歧义与风险识别、需求边界收敛、AC 可验证性映射。

**下一阶段（propose approaches）建议聚焦**：
1. 解析器插件架构与统一中间数据模型（normalized schema）设计；
2. 执行模式的后台任务编排（run_in_background + 轮询）方案；
3. 报告模板渲染层（Markdown 优先，预留 HTML/JSON 扩展）结构；
4. fixture 策略（含 Jest/Vitest/JUnit XML、失败用例、损坏文件、覆盖率有无四类 fixture）。

---

## 附录 A：探查到的关键文件路径与行号引用

> 仅记录路径与关键行号，不纳入全文（遵循上下文精简原则）。

| 文件 | 关键行号 | 用途 |
|---|---|---|
| `package.json` | L1–L94（全文 94 行） | 项目元信息、技术栈、test 脚本缺失确认 |
| `package.json` | L2 name、L3 version、L5 description | iMoney v1.0.0 记账小程序 |
| `package.json` | L6–L11 templateInfo | React + TypeScript + Less 模板 |
| `project.config.json` | 存在（根目录） | 微信小程序项目类型判定 |
| `.husky/` | 目录存在 | commitlint 质量门，无测试门 |
| `commitlint.config.mjs` | 存在 | 提交规范，非测试 |
| `tsconfig.json` | 存在 | TypeScript 配置 |

**未探查到**（确认缺失，作为"无测试基建"证据）：
- `jest.config.*` / `vitest.config.*` / `pytest.ini` / `setupTests.*`
- `package.json` 的 `scripts.test` 字段
- `reports/` / `coverage/` 产物目录

---

## 附录 B：决策记录摘要（供后续阶段追溯）

| 决策项 | 决策 | 依据优先级 | 阻断? |
|---|---|---|---|
| Q1 项目栈 | TS/Node 为主，P0=Jest/Vitest+JUnit XML | 上下文优先 | 否 |
| Q1 附加（AC1 验证） | 解析模式兜底 + fixture 留待 M1 | 上下文优先 | 否 |
| Q2 模板语言 | 仅中文模板 | 安全兜底 | 否 |
| Q3 渠道推送 | 本期不做 | 需求文档非目标 | 否 |
| "4 个任务数量"口径 | 限定 US/FR/Milestone 三组=4 | 逐类计数 | 否 |
| NFR3 脱敏 | 解析层正则脱敏 env 凭据 | 行业最佳实践 | 否 |
| R2 长任务 | run_in_background + background_exec | 运行时能力 | 否 |

---

*本文件为 clarify 阶段交付物，用于衔接 brainstorming 后续阶段。如需进入 propose approaches / design 阶段，请触发下一阶段任务节点。*
