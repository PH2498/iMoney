# Requirement: 测试执行与结果收集 (FR1)

## Overview

Agent 在执行测试后自动识别项目测试框架、触发测试运行或解析已有结果，并将异构结果统一为内部数据模型，供报告生成器消费。

## Scenarios

### FR1.1 自动识别测试框架与运行命令

**Given** 一个使用测试框架的项目
**When** 用户触发「生成测试报告」且未显式指定 `test_command`
**Then** Skill 按以下优先级识别框架与运行命令：
- 用户显式指定的命令（最高优先级）；
- 项目配置文件（`package.json` scripts.test、`pyproject.toml`、`Cargo.toml`）；
- 框架特征文件推断（如 `jest.config.*`、`vitest.config.*`、`pytest.ini`）。
**And** 识别失败时，向用户返回明确诊断信息并说明已检查的配置来源，不得静默选择默认命令。

### FR1.2 P0 框架与结果格式支持

**Given** 首期（M1）支持范围
**When** 解析测试结果
**Then** 必须支持以下框架 / 结果格式：
- JavaScript/TypeScript：Jest、Vitest（JSON reporter）；
- Python：pytest（JUnit XML / JSON report）——P1（M2）补充；
- 通用：JUnit XML（作为跨语言兜底格式）。
**And** 每个框架由独立解析器插件实现，共享统一中间数据模型 `TestResultModel`。

### FR1.3 执行模式与解析模式

**Given** 两种工作模式
**When** 用户未指定 `result_file`
**Then** 进入执行模式：Skill 触发测试运行并收集结果文件路径。

**Given** 用户指定了 `result_file`（如 `./junit.xml`、`./test-results.json`）
**When** Skill 检测到该参数
**Then** 进入解析模式：跳过测试执行，直接解析指定结果文件（满足 US4 CI 复用场景）。

### FR1.4 测试执行失败诊断

**Given** 测试命令无法运行（非用例失败，而是命令执行本身失败，例如：命令不存在、配置错误、权限不足）
**When** Skill 捕获到执行层失败
**Then** 不得生成空报告冒充成功
**And** 必须返回明确诊断信息，包含：失败的命令、错误输出摘要、可能原因提示（如「框架未安装」「命令未在 package.json scripts 中定义」）。

## Out of Scope

- 不自动安装缺失的测试框架（仅诊断提示）；
- 不修改测试代码或自动修复失败用例；
- P2 框架（Go test / cargo test）不在本期范围。
