/**
 * Jest JSON 解析器（T1.4）
 *
 * 解析 Jest JSON reporter 输出 → TestResultModel
 * 处理 Jest 特有字段：numPassedTests、numFailedTests、testResults[].assertionResults[]
 *
 * 必选字段：numTotalTests, numPassedTests, numFailedTests（缺失则抛错 AC4）
 * 可选字段：numPendingTests, numTodoTests, frameworkVersion, coverage（缺失标注「未获取」NFR2）
 */
import type {
  TestResultModel,
  TestFailure,
  TestDetailGroup,
  TestCase,
  CaseStatus,
} from '../types';
import { MAX_STACK_LINES, TOOL_VERSION } from '../types';
import type { TestResultParser } from './registry';

interface JestAssertionResult {
  title?: string;
  status?: string;
  failureMessages?: string[];
  duration?: number;
  fullName?: string;
}

interface JestTestResult {
  name?: string;
  perfStats?: { runtime?: number; slow?: boolean };
  assertionResults?: JestAssertionResult[];
  message?: string;
}

interface JestJsonReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  testResults?: JestTestResult[];
  coverageMap?: unknown;
  success?: boolean;
}

function truncateStack(stackText: string, maxLines: number): string[] {
  const lines = stackText.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines), `...（截断，共 ${lines.length} 行）`];
}

export class JestParser implements TestResultParser {
  name = 'jest';

  canHandle(filePath: string, content?: string): boolean {
    const lower = filePath.toLowerCase();
    if (lower.includes('jest') && (lower.endsWith('.json') || lower.endsWith('.json.txt'))) {
      return true;
    }
    if (content) {
      try {
        const data = JSON.parse(content) as JestJsonReport;
        // Jest JSON 的特征字段
        return (
          'numTotalTests' in data &&
          'numPassedTests' in data &&
          Array.isArray(data.testResults)
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  parse(raw: string): TestResultModel {
    let data: JestJsonReport;
    try {
      data = JSON.parse(raw) as JestJsonReport;
    } catch (e) {
      throw new Error(
        `[jest-parser] 结果文件不是合法 JSON: ${(e as Error).message}`
      );
    }

    // 必选字段校验（D6 / AC4）
    if (data.numTotalTests === undefined) {
      throw new Error('[jest-parser] 缺少必选字段 numTotalTests，无法生成报告。');
    }
    if (data.numPassedTests === undefined) {
      throw new Error('[jest-parser] 缺少必选字段 numPassedTests，无法生成报告。');
    }
    if (data.numFailedTests === undefined) {
      throw new Error('[jest-parser] 缺少必选字段 numFailedTests，无法生成报告。');
    }

    const total = data.numTotalTests;
    const passed = data.numPassedTests;
    const failed = data.numFailedTests;
    // skipped = pending + todo（两者求和）
    const skipped =
      (data.numPendingTests ?? 0) + (data.numTodoTests ?? 0);

    // 总耗时：取所有 testResult 的 perfStats.runtime 求和
    const durationMs = (data.testResults ?? []).reduce(
      (sum, tr) => sum + (tr.perfStats?.runtime ?? 0),
      0
    );

    const passRate =
      total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

    // 解析 details 与 failures
    const details: TestDetailGroup[] = [];
    const failures: TestFailure[] = [];

    for (const tr of data.testResults ?? []) {
      const filePath = tr.name ?? '<未知文件>';
      const cases: TestCase[] = [];

      for (const ar of tr.assertionResults ?? []) {
        const status = this.normalizeStatus(ar.status ?? 'passed');
        const tc: TestCase = {
          name: ar.title ?? ar.fullName ?? '<未命名用例>',
          durationMs: ar.duration ?? 0,
          status,
        };
        cases.push(tc);

        // 提取失败用例
        if (status === 'failed' && ar.failureMessages && ar.failureMessages.length > 0) {
          const errMsg = ar.failureMessages.join('\n');
          const stackLines = truncateStack(errMsg, MAX_STACK_LINES);
          failures.push({
            testName: tc.name,
            filePath,
            errorMessage: ar.failureMessages[0] ?? '未获取到错误信息',
            stackTrace: stackLines,
          });
        }
      }

      details.push({ filePath, cases });
    }

    // 确定性排序：按文件路径字母序（D5 / NFR4）
    details.sort((a, b) => a.filePath.localeCompare(b.filePath));
    failures.sort((a, b) =>
      `${a.filePath}::${a.testName}`.localeCompare(`${b.filePath}::${b.testName}`)
    );

    return {
      header: {
        projectName: this.detectProjectName(),
        generatedAt: new Date().toISOString(),
        executedCommand: 'jest --json',
        framework: 'jest',
        frameworkVersion: undefined, // Jest JSON 输出不含版本，标注「未获取」
        environment: {
          os: process.platform,
          runtime: `Node ${process.version}`,
        },
      },
      summary: { total, passed, failed, skipped, passRate, durationMs },
      failures,
      details,
      coverage: undefined, // Jest coverage 需额外解析 coverage-final.json（T2.2）
      appendix: {
        sourceResultFile: '<jest-json>',
        toolVersion: TOOL_VERSION,
      },
    };
  }

  private normalizeStatus(raw: string): CaseStatus {
    switch (raw) {
      case 'failed':
        return 'failed';
      case 'pending':
      case 'todo':
      case 'skipped':
        return 'skipped';
      default:
        return 'passed';
    }
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
