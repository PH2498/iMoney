/**
 * Markdown 报告生成器 —— 实现 FR2（报告内容标准结构）与 FR3（Markdown 落盘）。
 *
 * 报告章节顺序固定：
 *   1. 报告头：项目名、生成时间、执行命令、框架/版本、执行环境摘要
 *   2. 结果摘要：用例总数、通过/失败/跳过数、通过率、总耗时；整体结论 ✅/❌
 *   3. 失败用例分析（有失败时必选）：用例名、所属文件、错误信息、堆栈关键行
 *   4. 用例明细：按测试文件分组的用例列表与各自耗时（>200 截断并注明）
 *   5. 覆盖率（若可获取）：语句/分支/函数/行覆盖率总表，低于阈值的文件清单
 *   6. 附录：原始结果文件路径、生成工具版本
 *
 * NFR2：缺失项标注「未获取」，不崩溃。
 * NFR3：不再重复过滤（解析层已 redact），此处仅格式化。
 * NFR4：幂等性——生成时间单独标注，其余内容确定性。
 */
import type {
  ReportConfig,
  TestResult,
  TestCase,
} from './types.ts';

/** 用例明细截断阈值 */
const DETAIL_CASE_LIMIT = 200;

/** 格式化毫秒为可读时长 */
function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '未获取';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(1);
  return `${m}m${s}s`;
}

/** 生成时间戳（幂等性：仅此字段随时间变化） */
function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 报告文件名时间戳：YYYYMMDD-HHmmss */
function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 转义 Markdown 特殊字符（单元格内） */
function esc(s: string | undefined): string {
  if (s === undefined || s === '') return '未获取';
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '未获取';
}

/** 状态图标 */
function statusIcon(status: string): string {
  switch (status) {
    case 'passed':
      return '✅';
    case 'failed':
      return '❌';
    case 'error':
      return '⛔';
    case 'skipped':
      return '⏭️';
    default:
      return '⏸️';
  }
}

export interface MarkdownReportInput {
  result: TestResult;
  config: ReportConfig;
  /** 执行环境摘要（Node 版本、OS 等），未获取则 undefined */
  envSummary?: string;
  /** 生成工具版本 */
  toolVersion: string;
  /** 报告头执行命令（解析模式可能为空） */
  executedCommand?: string;
  /** 项目名（覆盖 config.projectName） */
  projectName?: string;
}

export interface MarkdownReportOutput {
  /** 报告内容 */
  content: string;
  /** 报告文件名（含目录） */
  reportPath: string;
  /** JSON 结构化数据伴随产物内容（若生成） */
  jsonContent?: string;
  /** JSON 伴随产物路径（若生成） */
  jsonPath?: string;
}

export function generateMarkdownReport(input: MarkdownReportInput): MarkdownReportOutput {
  const { result, config, envSummary, toolVersion } = input;
  const projectName = input.projectName ?? config.projectName ?? '未获取';
  const executedCommand = input.executedCommand ?? config.testCommand ?? '未获取（解析模式）';
  const lines: string[] = [];

  // ===== 1. 报告头 =====
  lines.push(`# 测试报告 - ${esc(projectName)}`);
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| 项目名 | ${esc(projectName)} |`);
  lines.push(`| 生成时间 | ${nowTimestamp()} |`);
  lines.push(`| 执行命令 | \`${esc(executedCommand)}\` |`);
  lines.push(`| 测试框架 | ${esc(result.framework)} |`);
  lines.push(`| 框架版本 | ${esc(result.frameworkVersion)} |`);
  lines.push(`| 执行环境 | ${esc(envSummary)} |`);
  lines.push('');

  // ===== 2. 结果摘要 =====
  const conclusion = isPass(result, config) ? '✅ 通过' : '❌ 未通过';
  lines.push('## 结果摘要');
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| 用例总数 | ${result.total} |`);
  lines.push(`| 通过 | ${result.passed} |`);
  lines.push(`| 失败 | ${result.failed} |`);
  lines.push(`| 跳过 | ${result.skipped} |`);
  lines.push(`| 通过率 | ${result.passRate}% |`);
  lines.push(`| 总耗时 | ${formatDuration(result.totalDurationMs)} |`);
  lines.push(`| 整体结论 | ${conclusion} |`);
  if (config.failThreshold !== undefined) {
    const thresholdMet = result.passRate >= config.failThreshold;
    lines.push(`| 通过率阈值 | ${config.failThreshold}%（${thresholdMet ? '达标' : '不达标'}） |`);
  }
  lines.push('');

  // ===== 3. 失败用例分析 =====
  const failures = collectFailures(result);
  if (failures.length > 0) {
    lines.push('## 失败用例分析');
    lines.push('');
    lines.push(`共 ${failures.length} 条失败用例：`);
    lines.push('');
    const topFailures = failures.slice(0, 3);
    for (let i = 0; i < failures.length; i++) {
      const f = failures[i];
      lines.push(`### ${i + 1}. ${esc(f.name)}`);
      lines.push('');
      lines.push(`- **状态**：${statusIcon(f.status)} ${f.status}`);
      lines.push(`- **所属文件**：\`${esc(f.file)}\``);
      if (f.ancestorPath && f.ancestorPath.length > 0) {
        lines.push(`- **所属套件**：${esc(f.ancestorPath.join(' › '))}`);
      }
      lines.push(`- **错误信息**：`);
      lines.push('');
      lines.push('```');
      lines.push(f.errorMessage ?? '未获取');
      lines.push('```');
      if (f.stackTrace) {
        lines.push('');
        lines.push('- **堆栈关键行**：');
        lines.push('');
        lines.push('```');
        lines.push(f.stackTrace);
        lines.push('```');
      }
      lines.push('');
    }
    if (failures.length > 3) {
      lines.push(`> 其余 ${failures.length - 3} 条失败用例见下方「用例明细」。`);
      lines.push('');
    }
  } else if (result.failed === 0) {
    lines.push('## 失败用例分析');
    lines.push('');
    lines.push('> 无失败用例 ✅');
    lines.push('');
  }

  // ===== 4. 用例明细 =====
  lines.push('## 用例明细');
  lines.push('');
  let totalCaseCount = 0;
  for (const suite of result.suites) {
    totalCaseCount += suite.cases.length;
  }
  if (totalCaseCount === 0) {
    lines.push('> 未获取到用例明细（结果文件可能未提供用例级数据）。');
    lines.push('');
  } else {
    const truncated = totalCaseCount > DETAIL_CASE_LIMIT;
    let shown = 0;
    for (const suite of result.suites) {
      if (suite.cases.length === 0) continue;
      if (truncated && shown >= DETAIL_CASE_LIMIT) break;
      lines.push(`<details>`);
      lines.push(`<summary>${esc(suite.title)}（${suite.cases.length} 条，耗时 ${formatDuration(suite.durationMs)}）</summary>`);
      lines.push('');
      lines.push('| 状态 | 用例名 | 耗时 |');
      lines.push('| --- | --- | --- |');
      for (const tc of suite.cases) {
        if (truncated && shown >= DETAIL_CASE_LIMIT) break;
        lines.push(`| ${statusIcon(tc.status)} | ${esc(tc.name)} | ${formatDuration(tc.durationMs)} |`);
        shown += 1;
      }
      lines.push('');
      lines.push(`</details>`);
      lines.push('');
    }
    if (truncated) {
      lines.push(`> ⚠️ 用例总数 ${totalCaseCount} 超过 ${DETAIL_CASE_LIMIT} 条，已截断展示前 ${shown} 条。`);
      lines.push('');
    }
  }

  // ===== 5. 覆盖率 =====
  lines.push('## 覆盖率');
  lines.push('');
  if (result.coverage) {
    const c = result.coverage;
    lines.push('| 指标 | 覆盖率 |');
    lines.push('| --- | --- |');
    lines.push(`| 语句覆盖 | ${fmtCov(c.statements)} |`);
    lines.push(`| 分支覆盖 | ${fmtCov(c.branches)} |`);
    lines.push(`| 函数覆盖 | ${fmtCov(c.functions)} |`);
    lines.push(`| 行覆盖 | ${fmtCov(c.lines)} |`);
    lines.push('');
    if (c.lowCoverageFiles && c.lowCoverageFiles.length > 0) {
      lines.push(`### 低于阈值的文件清单（${c.lowCoverageFiles.length} 个）`);
      lines.push('');
      lines.push('| 文件 | 语句 | 分支 | 函数 | 行 |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const f of c.lowCoverageFiles.slice(0, 50)) {
        lines.push(`| \`${esc(f.file)}\` | ${fmtCov(f.statements)} | ${fmtCov(f.branches)} | ${fmtCov(f.functions)} | ${fmtCov(f.lines)} |`);
      }
      if (c.lowCoverageFiles.length > 50) {
        lines.push(`> 仅展示前 50 个低覆盖文件，共 ${c.lowCoverageFiles.length} 个。`);
      }
      lines.push('');
    }
  } else {
    lines.push('> 覆盖率数据未获取。');
    lines.push('');
  }

  // ===== 6. 附录 =====
  lines.push('## 附录');
  lines.push('');
  lines.push('| 项 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| 原始结果文件 | \`${esc(result.sourceFile)}\` |`);
  lines.push(`| 生成工具 | test-report-generator v${esc(toolVersion)} |`);
  lines.push(`| 报告格式 | markdown |`);
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('### 解析降级提示');
    lines.push('');
    for (const w of result.warnings) {
      lines.push(`- ${esc(w)}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*本报告由 test-report-generator 自动生成，内容确定性（除生成时间外幂等）。*`);

  const content = lines.join('\n');
  const reportPath = `${config.outputPath.replace(/\/$/, '')}/test-report-${fileTimestamp()}.md`;

  // JSON 伴随产物（FR3.1 可选）
  let jsonContent: string | undefined;
  let jsonPath: string | undefined;
  if (config.outputFormat === 'json') {
    jsonContent = JSON.stringify(
      {
        reportGeneratedAt: nowTimestamp(),
        tool: 'test-report-generator',
        toolVersion,
        result,
      },
      null,
      2,
    );
    jsonPath = `${config.outputPath.replace(/\/$/, '')}/test-report-${fileTimestamp()}.json`;
  }

  return { content, reportPath, jsonContent, jsonPath };
}

/** 判定整体是否通过：失败数为 0 且通过率达标（若有阈值） */
function isPass(result: TestResult, config: ReportConfig): boolean {
  if (result.failed > 0) return false;
  if (config.failThreshold !== undefined && result.passRate < config.failThreshold) return false;
  return true;
}

/** 收集所有失败用例（含 error） */
function collectFailures(result: TestResult): TestCase[] {
  const failures: TestCase[] = [];
  for (const suite of result.suites) {
    for (const tc of suite.cases) {
      if (tc.status === 'failed' || tc.status === 'error') {
        failures.push(tc);
      }
    }
  }
  return failures;
}

/** 格式化覆盖率百分比 */
function fmtCov(val: number | undefined): string {
  if (val === undefined) return '未获取';
  return `${val.toFixed(2)}%`;
}

/** 导出文件名时间戳工具，供主入口复用 */
export { fileTimestamp as makeFileTimestamp };
