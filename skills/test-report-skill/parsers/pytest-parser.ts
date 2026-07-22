/**
 * pytest 解析器（T2.1）
 *
 * 支持 pytest 两种结果格式：
 *  1. JUnit XML（pytest --junitxml=xxx.xml）→ 复用 JUnitParser 逻辑
 *  2. JSON report（pytest --report-file=xxx.json 或 pytest-json-report 插件）
 *
 * QD2 结论：pytest JUnit XML 符合标准 JUnit 格式，XML 路径由 JUnitParser 兜底处理。
 * 本解析器仅处理 pytest JSON report 格式。
 */
import type {
  TestResultModel,
  TestFailure,
  TestDetailGroup,
  TestCase,
} from '../types';
import { MAX_STACK_LINES, TOOL_VERSION } from '../types';
import type { TestResultParser } from './registry';

/** pytest-json-report 结构 */
interface PytestJsonReport {
  created?: number;
  duration?: number;
  exitcode?: number;
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    xfailed?: number;
    xpassed?: number;
  };
  tests?: Array<{
    nodeid?: string;
    outcome?: string; // "passed" | "failed" | "skipped"
    duration?: number;
    call?: {
      duration?: number;
      longrepr?: string;
      crash?: { message?: string };
    };
    setup?: { duration?: number; outcome?: string };
    teardown?: { duration?: number; outcome?: string };
  }>;
  root?: string;
}

function truncateStack(text: string, maxLines: number): string[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines), `...（截断，共 ${lines.length} 行）`];
}

export class PytestParser implements TestResultParser {
  name = 'pytest';

  canHandle(filePath: string, content?: string): boolean {
    const lower = filePath.toLowerCase();
    // JSON 格式探测
    if (
      lower.endsWith('.json') &&
      (lower.includes('pytest') || lower.includes('report'))
    ) {
      if (content) {
        try {
          const data = JSON.parse(content) as PytestJsonReport;
          // pytest-json-report 特征字段
          return (
            'summary' in data &&
            'tests' in data &&
            Array.isArray(data.tests)
          );
        } catch {
          return false;
        }
      }
      return true;
    }
    // JUnit XML 格式由 JUnitParser 兜底，此处不重复处理
    return false;
  }

  parse(raw: string): TestResultModel {
    let data: PytestJsonReport;
    try {
      data = JSON.parse(raw) as PytestJsonReport;
    } catch (e) {
      throw new Error(
        `[pytest-parser] 结果文件不是合法 JSON: ${(e as Error).message}`
      );
    }

    // 必选字段校验（D6 / AC4）
    if (!data.summary) {
      throw new Error('[pytest-parser] 缺少必选字段 summary，无法生成报告。');
    }
    if (data.summary.total === undefined) {
      throw new Error('[pytest-parser] 缺少必选字段 summary.total，无法生成报告。');
    }

    const total = data.summary.total;
    const passed = data.summary.passed ?? 0;
    const failed = data.summary.failed ?? 0;
    const skipped =
      (data.summary.skipped ?? 0) +
      (data.summary.xfailed ?? 0) +
      (data.summary.xpassed ?? 0);
    const durationMs = Math.round((data.duration ?? 0) * 1000);

    const passRate =
      total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

    const details: TestDetailGroup[] = [];
    const failures: TestFailure[] = [];
    const groupMap = new Map<string, TestCase[]>();

    for (const test of data.tests ?? []) {
      const nodeid = test.nodeid ?? '<未命名用例>';
      // nodeid 格式: tests/test_foo.py::TestFoo::test_bar
      const filePath = nodeid.includes('::')
        ? nodeid.split('::')[0]
        : nodeid;

      const outcome = test.outcome ?? 'passed';
      const status: TestCase['status'] =
        outcome === 'failed'
          ? 'failed'
          : outcome === 'skipped' || outcome === 'xfailed'
          ? 'skipped'
          : 'passed';

      const duration = Math.round((test.call?.duration ?? test.duration ?? 0) * 1000);

      const tc: TestCase = {
        name: nodeid,
        durationMs: duration,
        status,
      };

      if (!groupMap.has(filePath)) groupMap.set(filePath, []);
      groupMap.get(filePath)!.push(tc);

      // 提取失败用例
      if (status === 'failed') {
        const crashMsg = test.call?.crash?.message ?? '';
        const longrepr = test.call?.longrepr ?? '';
        const errMsg = crashMsg || longrepr.split('\n').pop() || '未获取到错误信息';
        const stackText = longrepr || crashMsg || errMsg;

        failures.push({
          testName: nodeid,
          filePath,
          errorMessage: errMsg,
          stackTrace: truncateStack(stackText, MAX_STACK_LINES),
        });
      }
    }

    for (const [fp, cases] of groupMap) {
      details.push({ filePath: fp, cases });
    }

    // 确定性排序（D5 / NFR4）
    details.sort((a, b) => a.filePath.localeCompare(b.filePath));
    failures.sort((a, b) =>
      `${a.filePath}::${a.testName}`.localeCompare(`${b.filePath}::${b.testName}`)
    );

    return {
      header: {
        projectName: this.detectProjectName(),
        generatedAt: new Date().toISOString(),
        executedCommand: 'pytest --report-file=test-report.json',
        framework: 'pytest',
        frameworkVersion: undefined,
        environment: {
          os: process.platform,
          runtime: 'Python', // 精确版本需从 pytest 输出提取
        },
      },
      summary: { total, passed, failed, skipped, passRate, durationMs },
      failures,
      details,
      coverage: undefined,
      appendix: {
        sourceResultFile: '<pytest-json>',
        toolVersion: TOOL_VERSION,
      },
    };
  }

  private detectProjectName(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../../package.json');
      return pkg.name ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
