/**
 * Jest JSON reporter 解析器。
 *
 * Jest `--json` 输出顶层结构（节选）：
 *   numTotalTests, numPassedTests, numFailedTests, numPendingTests, numTodoTests,
 *   startTime, success, testResults: [{
 *     name: "<test file path>", status: "passed"|"failed"|"skipped",
 *     message, startTime, endTime, assertionResults: [{
 *       ancestorTitles: string[], fullName: string, status, title, duration, failureMessages: string[]
 *     }]
 *   }], coverageMap?(可选)
 *
 * 健壮性：字段缺失降级标注「未获取」，不崩溃（NFR2）。
 */
import type { TestCase, TestResult, TestResultParser, TestSuite, TestStatus } from '../types.ts';
import { safeNumber, safeRead, safeString, sanitizeFailure } from '../security.ts';

interface JestAssertionResult {
  ancestorTitles?: string[];
  fullName?: string;
  title?: string;
  status?: string;
  duration?: number;
  failureMessages?: string[];
}

interface JestTestResultEntry {
  name?: string;
  status?: string;
  message?: string;
  startTime?: number;
  endTime?: number;
  assertionResults?: JestAssertionResult[];
}

interface JestJsonReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  numTotalTestSuites?: number;
  numPassedTestSuites?: number;
  numFailedTestSuites?: number;
  startTime?: number;
  success?: boolean;
  testResults?: JestTestResultEntry[];
  coverageMap?: unknown;
}

/** Jest 状态映射到统一状态 */
function mapStatus(raw: string | undefined): TestStatus {
  switch (raw) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'skipped':
    case 'pending':
    case 'todo':
    case 'disabled':
      return 'skipped';
    default:
      return 'pending';
  }
}

export class JestJsonParser implements TestResultParser {
  readonly name = 'jest';

  canParse(filePath: string, content: string): boolean {
    const looksJson = filePath.toLowerCase().endsWith('.json');
    if (!looksJson) return false;
    try {
      const data = JSON.parse(content) as JestJsonReport;
      // Jest JSON 的强特征：存在 testResults 数组，且断言有 title/status
      return Array.isArray(data.testResults) && data.testResults.length >= 0;
    } catch {
      return false;
    }
  }

  parse(filePath: string, content: string): TestResult {
    let data: JestJsonReport;
    try {
      data = JSON.parse(content) as JestJsonReport;
    } catch (e) {
      throw new Error(`Jest JSON 解析失败：内容不是合法 JSON。${e instanceof Error ? e.message : ''}`);
    }
    const warnings: string[] = [];
    const suites: TestSuite[] = [];
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let hasDurationData = false;

    const testResults = Array.isArray(data.testResults) ? data.testResults : [];
    for (const entry of testResults) {
      const file = safeString(entry.name) ?? '';
      const cases: TestCase[] = [];
      const assertions = Array.isArray(entry.assertionResults) ? entry.assertionResults : [];
      for (const a of assertions) {
        const status = mapStatus(a.status);
        const failureMessages = Array.isArray(a.failureMessages) ? a.failureMessages.filter(Boolean) : [];
        // 合并失败信息与可能的 suite message
        const rawMessage = failureMessages.join('\n') || (entry.message && status !== 'passed' ? entry.message : undefined);
        const { errorMessage, stackTrace } = sanitizeFailure(rawMessage, undefined);
        const duration = safeNumber(a.duration);
        if (duration !== undefined) hasDurationData = true;
        cases.push({
          name: safeString(a.title) ?? safeString(a.fullName) ?? '(未命名用例)',
          file,
          status,
          ...(duration !== undefined ? { durationMs: duration } : {}),
          ...(errorMessage ? { errorMessage } : {}),
          ...(stackTrace ? { stackTrace } : {}),
          ...(Array.isArray(a.ancestorTitles) && a.ancestorTitles.length > 0
            ? { ancestorPath: a.ancestorTitles.filter(Boolean) }
            : {}),
        });
        total += 1;
        if (status === 'passed') passed += 1;
        else if (status === 'failed') failed += 1;
        else if (status === 'skipped') skipped += 1;
      }
      // 套件耗时（如有）
      const start = safeNumber(entry.startTime);
      const end = safeNumber(entry.endTime);
      const suiteDuration = start !== undefined && end !== undefined && end >= start ? end - start : undefined;
      suites.push({
        title: file || '(未知测试文件)',
        cases,
        ...(suiteDuration !== undefined ? { durationMs: suiteDuration } : {}),
      });
    }

    // 用顶层汇总校验/兜底（解析出来的逐条计数可能因格式差异不全）
    const topTotal = safeNumber(data.numTotalTests);
    const topPassed = safeNumber(data.numPassedTests);
    const topFailed = safeNumber(data.numFailedTests);
    const topSkipped = safeNumber(data.numPendingTests) ?? safeNumber(data.numTodoTests);
    if (topTotal === undefined && total === 0) {
      warnings.push('未提取到任何测试用例，可能结果文件为空或格式异常');
    }
    const finalTotal = topTotal ?? total;
    const finalPassed = topPassed ?? passed;
    const finalFailed = topFailed ?? failed;
    const finalSkipped = topSkipped ?? skipped;

    // 总耗时：Jest 提供 startTime 但无总耗时，用 suites 之和或顶层缺失
    const totalDuration = hasDurationData
      ? suites.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) || undefined
      : undefined;
    if (totalDuration === undefined) {
      warnings.push('总耗时未获取（Jest JSON 未提供总耗时字段）');
    }

    const passRate = finalTotal > 0 ? Number(((finalPassed / finalTotal) * 100).toFixed(2)) : 0;

    return {
      framework: this.name,
      sourceFile: filePath,
      total: finalTotal,
      passed: finalPassed,
      failed: finalFailed,
      skipped: finalSkipped,
      passRate,
      ...(totalDuration !== undefined ? { totalDurationMs: totalDuration } : {}),
      suites,
      warnings,
    };
  }
}
