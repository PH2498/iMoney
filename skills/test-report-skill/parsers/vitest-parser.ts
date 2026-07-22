/**
 * Vitest JSON 解析器（T1.5）
 *
 * 解析 Vitest JSON reporter 输出 → TestResultModel
 * 注意：Vitest 与 Jest JSON 结构高度相似但非完全一致，须独立实现（QD1）
 *
 * Vitest 特有差异：
 *  - 错误结构在 result.errors 而非 assertionResults.failureMessages
 *  - testResults 项可能含 result 对象
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

interface VitestError {
  name?: string;
  message?: string;
  stack?: string;
}

interface VitestAssertionResult {
  name?: string;
  fullName?: string;
  status?: string;
  duration?: number;
  errors?: VitestError[];
}

interface VitestTestResult {
  name?: string;
  /** Vitest 特有：perfStats 或 runtime */
  runtime?: number;
  duration?: number;
  assertionResults?: VitestAssertionResult[];
  errors?: VitestError[];
}

interface VitestJsonReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  testResults?: VitestTestResult[];
  success?: boolean;
  startTime?: number;
}

function truncateStack(stackText: string, maxLines: number): string[] {
  const lines = stackText.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines), `...（截断，共 ${lines.length} 行）`];
}

export class VitestParser implements TestResultParser {
  name = 'vitest';

  canHandle(filePath: string, content?: string): boolean {
    const lower = filePath.toLowerCase();
    if (lower.includes('vitest') && lower.endsWith('.json')) {
      return true;
    }
    if (content) {
      try {
        const data = JSON.parse(content) as VitestJsonReport;
        // Vitest JSON 特征：testResults[].assertionResults[].errors 或 testResults[].errors
        if (!('numTotalTests' in data) || !Array.isArray(data.testResults)) {
          return false;
        }
        const tr0 = data.testResults[0];
        return (
          tr0?.assertionResults?.[0]?.errors !== undefined ||
          tr0?.errors !== undefined ||
          'startTime' in data
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  parse(raw: string): TestResultModel {
    let data: VitestJsonReport;
    try {
      data = JSON.parse(raw) as VitestJsonReport;
    } catch (e) {
      throw new Error(
        `[vitest-parser] 结果文件不是合法 JSON: ${(e as Error).message}`
      );
    }

    if (data.numTotalTests === undefined) {
      throw new Error('[vitest-parser] 缺少必选字段 numTotalTests，无法生成报告。');
    }
    if (data.numPassedTests === undefined) {
      throw new Error('[vitest-parser] 缺少必选字段 numPassedTests，无法生成报告。');
    }
    if (data.numFailedTests === undefined) {
      throw new Error('[vitest-parser] 缺少必选字段 numFailedTests，无法生成报告。');
    }

    const total = data.numTotalTests;
    const passed = data.numPassedTests;
    const failed = data.numFailedTests;
    const skipped = data.numPendingTests ?? 0;

    const durationMs = (data.testResults ?? []).reduce(
      (sum, tr) => sum + (tr.runtime ?? tr.duration ?? 0),
      0
    );

    const passRate =
      total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

    const details: TestDetailGroup[] = [];
    const failures: TestFailure[] = [];

    for (const tr of data.testResults ?? []) {
      const filePath = tr.name ?? '<未知文件>';
      const cases: TestCase[] = [];

      for (const ar of tr.assertionResults ?? []) {
        const status = this.normalizeStatus(ar.status ?? 'passed');
        const tc: TestCase = {
          name: ar.name ?? ar.fullName ?? '<未命名用例>',
          durationMs: ar.duration ?? 0,
          status,
        };
        cases.push(tc);

        // Vitest 特有：错误在 errors 数组（QD1 差异点）
        if (status === 'failed' && ar.errors && ar.errors.length > 0) {
          const err = ar.errors[0];
          const errMsg = err.message ?? '未获取到错误信息';
          const stackText = err.stack ?? errMsg;
          failures.push({
            testName: tc.name,
            filePath,
            errorMessage: errMsg,
            stackTrace: truncateStack(stackText, MAX_STACK_LINES),
          });
        }
      }

      // Vitest 特有：testResult 级别的 errors
      if (tr.errors && tr.errors.length > 0) {
        for (const err of tr.errors) {
          if (!failures.some((f) => f.testName === err.name)) {
            const errMsg = err.message ?? '未获取到错误信息';
            const stackText = err.stack ?? errMsg;
            failures.push({
              testName: err.name ?? '<testResult 错误>',
              filePath,
              errorMessage: errMsg,
              stackTrace: truncateStack(stackText, MAX_STACK_LINES),
            });
          }
        }
      }

      details.push({ filePath, cases });
    }

    details.sort((a, b) => a.filePath.localeCompare(b.filePath));
    failures.sort((a, b) =>
      `${a.filePath}::${a.testName}`.localeCompare(`${b.filePath}::${b.testName}`)
    );

    return {
      header: {
        projectName: this.detectProjectName(),
        generatedAt: new Date().toISOString(),
        executedCommand: 'vitest run --reporter=json',
        framework: 'vitest',
        frameworkVersion: undefined,
        environment: {
          os: process.platform,
          runtime: `Node ${process.version}`,
        },
      },
      summary: { total, passed, failed, skipped, passRate, durationMs },
      failures,
      details,
      coverage: undefined,
      appendix: {
        sourceResultFile: '<vitest-json>',
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
