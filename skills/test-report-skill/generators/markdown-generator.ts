/**
 * Markdown 报告生成器（T1.10）
 *
 * 输出标准六大章节（FR2.1~FR2.6），顺序固定
 * 失败用例堆栈截断至 20 行（FR2.3）
 * 用例明细超 200 条截断并注明（FR2.4）
 * 确定性渲染，仅 generatedAt 可变（NFR4）
 */
import type {
  TestResultModel,
  TestConfig,
} from '../types';
import { MAX_DETAIL_CASES } from '../types';

const NA = '未获取';

function formatTimestamp(iso: string): string {
  // ISO 8601 → YYYY-MM-DD HH:mm:ss（FR2.1）
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function statusIcon(status: 'passed' | 'failed' | 'skipped'): string {
  switch (status) {
    case 'passed':
      return '✅';
    case 'failed':
      return '❌';
    case 'skipped':
      return '⏭️';
  }
}

/** 计算总用例数（用于截断判断） */
function countTotalCases(model: TestResultModel): number {
  return model.details.reduce((sum, g) => sum + g.cases.length, 0);
}

export interface MarkdownGeneratorOptions {
  failThreshold?: number;
}

export class MarkdownGenerator {
  generate(model: TestResultModel, opts?: MarkdownGeneratorOptions): string {
    const lines: string[] = [];

    // FR2.1 报告头
    lines.push(...this.renderHeader(model));
    // FR2.2 结果摘要
    lines.push(...this.renderSummary(model, opts?.failThreshold));
    // FR2.3 失败用例分析
    lines.push(...this.renderFailures(model));
    // FR2.4 用例明细
    lines.push(...this.renderDetails(model));
    // FR2.5 覆盖率
    lines.push(...this.renderCoverage(model));
    // FR2.6 附录
    lines.push(...this.renderAppendix(model));

    return lines.join('\n');
  }

  private renderHeader(model: TestResultModel): string[] {
    const h = model.header;
    const fwVersion = h.frameworkVersion ?? NA;
    const envOs = h.environment?.os ?? NA;
    const envRuntime = h.environment?.runtime ?? NA;

    return [
      `# 测试报告 - ${h.projectName}`,
      ``,
      `> 生成时间: ${formatTimestamp(h.generatedAt)}`,
      `> 执行命令: \`${h.executedCommand}\``,
      `> 框架: ${h.framework} ${fwVersion}`,
      `> 环境: ${envOs} / ${envRuntime}`,
      ``,
    ];
  }

  private renderSummary(
    model: TestResultModel,
    failThreshold?: number
  ): string[] {
    const s = model.summary;
    const conclusion =
      s.failed === 0 ? '✅ 全部通过' : '❌ 存在失败';

    let thresholdMark = '';
    if (failThreshold !== undefined && s.passRate < failThreshold) {
      thresholdMark = ' ⚠️ 未达标';
    }

    return [
      `## 结果摘要`,
      ``,
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 用例总数 | ${s.total} |`,
      `| 通过 | ${s.passed} ✅ |`,
      `| 失败 | ${s.failed} ❌ |`,
      `| 跳过 | ${s.skipped} |`,
      `| 通过率 | ${s.passRate}% |`,
      `| 总耗时 | ${s.durationMs}ms |`,
      ``,
      `**结论: ${conclusion}${thresholdMark}**`,
      ``,
    ];
  }

  private renderFailures(model: TestResultModel): string[] {
    const lines: string[] = [`## 失败用例分析`, ``];

    if (model.failures.length === 0) {
      lines.push(`无失败用例。`, ``);
      return lines;
    }

    model.failures.forEach((f, idx) => {
      lines.push(`### ${idx + 1}. ${f.testName}`);
      lines.push(`- **文件**: \`${f.filePath}\``);
      lines.push(`- **错误**: ${f.errorMessage}`);
      if (f.stackTrace.length > 0) {
        lines.push(`- **堆栈**:`);
        lines.push('```');
        f.stackTrace.forEach((line) => lines.push(line));
        lines.push('```');
      }
      lines.push(``);
    });

    return lines;
  }

  private renderDetails(model: TestResultModel): string[] {
    const lines: string[] = [`## 用例明细`, ``];
    const totalCases = countTotalCases(model);
    let shown = 0;
    let truncated = false;

    for (const group of model.details) {
      if (shown >= MAX_DETAIL_CASES) {
        truncated = true;
        break;
      }
      lines.push(`<details>`);
      lines.push(`<summary>${group.filePath} (${group.cases.length} cases)</summary>`);
      lines.push(``);
      lines.push(`| 用例 | 耗时 | 状态 |`);
      lines.push(`|------|------|------|`);
      for (const tc of group.cases) {
        if (shown >= MAX_DETAIL_CASES) {
          truncated = true;
          break;
        }
        lines.push(
          `| ${tc.name} | ${tc.durationMs}ms | ${statusIcon(tc.status)} |`
        );
        shown++;
      }
      lines.push(``);
      lines.push(`</details>`);
      lines.push(``);
    }

    if (truncated) {
      lines.push(
        `> 已截断，共 ${totalCases} 条，展示前 ${MAX_DETAIL_CASES} 条`
      );
      lines.push(``);
    }

    return lines;
  }

  private renderCoverage(model: TestResultModel): string[] {
    if (!model.coverage) {
      return [`## 覆盖率`, ``, `未获取`, ``];
    }
    const c = model.coverage;
    const lines: string[] = [
      `## 覆盖率`,
      ``,
      `| 类型 | 覆盖率 |`,
      `|------|--------|`,
      `| 语句 | ${c.statements}% |`,
      `| 分支 | ${c.branches}% |`,
      `| 函数 | ${c.functions}% |`,
      `| 行 | ${c.lines}% |`,
      ``,
    ];

    if (c.belowThresholdFiles && c.belowThresholdFiles.length > 0) {
      lines.push(`低于阈值文件:`);
      c.belowThresholdFiles.forEach((f) => lines.push(`- \`${f}\``));
    } else {
      lines.push(`低于阈值文件: 无`);
    }
    lines.push(``);

    return lines;
  }

  private renderAppendix(model: TestResultModel): string[] {
    return [
      `## 附录`,
      ``,
      `- 原始结果文件: \`${model.appendix.sourceResultFile}\``,
      `- 生成工具版本: ${model.appendix.toolVersion}`,
      ``,
    ];
  }
}
