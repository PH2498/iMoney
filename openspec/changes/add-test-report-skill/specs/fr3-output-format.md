# Requirement: 输出格式与落盘 (FR3)

## Overview

报告默认输出 Markdown，支持多格式与可配置输出路径，生成后向用户返回报告路径与关键摘要。

## Scenarios

### FR3.1 默认输出格式

**Given** 用户未指定 `output_format`
**When** 生成报告
**Then** 默认输出 Markdown（`.md`）。
**And** P1（M3）支持 HTML 输出；JSON（结构化数据）作为可选伴随产物。

### FR3.2 默认输出路径

**Given** 用户未指定 `output_path`
**When** 生成报告
**Then** 默认输出路径为 `reports/test-report-<YYYYMMDD-HHmmss>.md`。
**And** 允许用户通过 `output_path` 参数指定输出目录或完整文件路径。

### FR3.3 生成后返回信息

**Given** 报告生成成功
**When** Skill 完成生成
**Then** 向用户返回：报告路径 + 结果摘要（通过率、失败数）。
**And** 存在失败用例时，附最关键的 1~3 条失败原因（按失败严重度/出现顺序排序）。

## Out of Scope

- 不做报告的在线托管或 Web 服务化展示；
- 不做 PDF 输出（本期）。
