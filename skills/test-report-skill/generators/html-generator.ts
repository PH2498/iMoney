/**
 * HTML 报告生成器（T3.1）
 *
 * QD3 决策：从 TestResultModel 独立渲染（非 Markdown 转 HTML），保证样式控制与结构一致性。
 * 输出六大章节的 HTML，结构与 Markdown 生成器保持一致（T3-V1）。
 */
import type {
  TestResultModel,
} from '../types';
import { MAX_DETAIL_CASES } from '../types';

const NA = '未获取';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return esc(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface HtmlGeneratorOptions {
  failThreshold?: number;
}

export class HtmlGenerator {
  generate(model: TestResultModel, opts?: HtmlGeneratorOptions): string {
    const sections: string[] = [];
    sections.push(this.renderHeader(model));
    sections.push(this.renderSummary(model, opts?.failThreshold));
    sections.push(this.renderFailures(model));
    sections.push(this.renderDetails(model));
    sections.push(this.renderCoverage(model));
    sections.push(this.renderAppendix(model));

    const body = sections.join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>测试报告 - ${esc(model.header.projectName)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { border-bottom: 2px solid #4a90d9; padding-bottom: 8px; }
  h2 { margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  .header-meta { background: #f9f9f9; padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
  .header-meta p { margin: 4px 0; }
  .conclusion { font-size: 1.1em; font-weight: bold; margin: 12px 0; }
  .truncate-note { color: #999; font-style: italic; margin: 8px 0; }
  .failure { background: #fff5f5; border-left: 3px solid #e74c3c; padding: 12px; margin: 12px 0; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 4px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 4px; border-radius: 2px; }
  details { margin: 8px 0; }
  summary { cursor: pointer; font-weight: 500; padding: 4px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
  }

  private renderHeader(model: TestResultModel): string {
    const h = model.header;
    return `
<h1>测试报告 - ${esc(h.projectName)}</h1>
<div class="header-meta">
  <p><strong>生成时间:</strong> ${formatTimestamp(h.generatedAt)}</p>
  <p><strong>执行命令:</strong> <code>${esc(h.executedCommand)}</code></p>
  <p><strong>框架:</strong> ${esc(h.framework)} ${esc(h.frameworkVersion ?? NA)}</p>
  <p><strong>环境:</strong> ${esc(h.environment?.os ?? NA)} / ${esc(h.environment?.runtime ?? NA)}</p>
</div>`;
  }

  private renderSummary(model: TestResultModel, failThreshold?: number): string {
    const s = model.summary;
    const conclusion = s.failed === 0 ? '✅ 全部通过' : '❌ 存在失败';
    let thresholdMark = '';
    if (failThreshold !== undefined && s.passRate < failThreshold) {
      thresholdMark = ' ⚠️ 未达标';
    }

    return `
<h2>结果摘要</h2>
<table>
  <tr><th>指标</th><th>值</th></tr>
  <tr><td>用例总数</td><td>${s.total}</td></tr>
  <tr><td>通过</td><td>${s.passed} ✅</td></tr>
  <tr><td>失败</td><td>${s.failed} ❌</td></tr>
  <tr><td>跳过</td><td>${s.skipped}</td></tr>
  <tr><td>通过率</td><td>${s.passRate}%</td></tr>
  <tr><td>总耗时</td><td>${s.durationMs}ms</td></tr>
</table>
<p class="conclusion">结论: ${conclusion}${thresholdMark}</p>`;
  }

  private renderFailures(model: TestResultModel): string {
    if (model.failures.length === 0) {
      return `\n<h2>失败用例分析</h2>\n<p>无失败用例。</p>`;
    }

    const items = model.failures
      .map(
        (f, idx) => `
<div class="failure">
  <h3>${idx + 1}. ${esc(f.testName)}</h3>
  <p><strong>文件:</strong> <code>${esc(f.filePath)}</code></p>
  <p><strong>错误:</strong> ${esc(f.errorMessage)}</p>${
    f.stackTrace.length > 0
      ? `\n  <p><strong>堆栈:</strong></p>\n  <pre>${esc(f.stackTrace.join('\n'))}</pre>`
      : ''
  }
</div>`
      )
      .join('\n');

    return `\n<h2>失败用例分析</h2>\n${items}`;
  }

  private renderDetails(model: TestResultModel): string {
    const totalCases = model.details.reduce(
      (sum, g) => sum + g.cases.length,
      0
    );
    let shown = 0;
    let truncated = false;

    const groups = model.details
      .map((group) => {
        if (shown >= MAX_DETAIL_CASES) {
          truncated = true;
          return '';
        }
        const rows = group.cases
          .map((tc) => {
            if (shown >= MAX_DETAIL_CASES) {
              truncated = true;
              return '';
            }
            const icon =
              tc.status === 'passed' ? '✅' : tc.status === 'failed' ? '❌' : '⏭️';
            shown++;
            return `      <tr><td>${esc(tc.name)}</td><td>${tc.durationMs}ms</td><td>${icon}</td></tr>`;
          })
          .join('\n');

        return `
<details>
  <summary>${esc(group.filePath)} (${group.cases.length} cases)</summary>
  <table>
    <tr><th>用例</th><th>耗时</th><th>状态</th></tr>
${rows}
  </table>
</details>`;
      })
      .join('\n');

    const note = truncated
      ? `\n<p class="truncate-note">已截断，共 ${totalCases} 条，展示前 ${MAX_DETAIL_CASES} 条</p>`
      : '';

    return `\n<h2>用例明细</h2>\n${groups}${note}`;
  }

  private renderCoverage(model: TestResultModel): string {
    if (!model.coverage) {
      return `\n<h2>覆盖率</h2>\n<p>未获取</p>`;
    }
    const c = model.coverage;
    const belowFiles =
      c.belowThresholdFiles && c.belowThresholdFiles.length > 0
        ? c.belowThresholdFiles.map((f) => `<li><code>${esc(f)}</code></li>`).join('\n')
        : '无';

    return `
<h2>覆盖率</h2>
<table>
  <tr><th>类型</th><th>覆盖率</th></tr>
  <tr><td>语句</td><td>${c.statements}%</td></tr>
  <tr><td>分支</td><td>${c.branches}%</td></tr>
  <tr><td>函数</td><td>${c.functions}%</td></tr>
  <tr><td>行</td><td>${c.lines}%</td></tr>
</table>
<p><strong>低于阈值文件:</strong></p>
<ul>${belowFiles}</ul>`;
  }

  private renderAppendix(model: TestResultModel): string {
    return `
<h2>附录</h2>
<ul>
  <li>原始结果文件: <code>${esc(model.appendix.sourceResultFile)}</code></li>
  <li>生成工具版本: ${esc(model.appendix.toolVersion)}</li>
</ul>`;
  }
}
