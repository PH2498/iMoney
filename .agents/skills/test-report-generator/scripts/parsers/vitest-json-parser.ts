/**
 * Vitest JSON reporter 解析器。
 *
 * Vitest `--reporter=json`（默认 json reporter）输出结构（节选）：
 *   numTotalTests, numPassedTests, numFailedTests, numPendingTests, numTodoTests,
 *   numTotalTestSuites, numPassedTestSuites, numFailedTestSuites,
 *   startTime, success, testResults: [{
 *     name, status, message?, startTime, endTime,
 *     assertionResults: [{ ancestorTitles, fullName, status, title, duration?, failureMessages?, errors?: [{message, stack}] }]
 *   }]
 *
 * 与 Jest 的主要差异：失败信息可能出现在 `errors[]`（含 message 与 stack），
 * 以及 `assertionResults` 可能缺 `duration`（Vitest 较新版本才提供）。
 *
 * 本解析器复用 Jest JSON 的结构归一化思路，独立实现以隔离差异（开闭原则：新增框架不影响既有解析器）。
 */
import type { TestCase, TestResult, TestResultParser, TestSuite, TestStatus } from '../types.ts';
import { safeNumber, safeRead, safeString, sanitizeFailure } from '../security.ts';

interface VitestError {
  message?: string;
  stack?: string;
}

interface VitestAssertionResult {
  ancestorTitles?: string[];
  fullName?: string;
  status?: string;
  title?: string;
  duration?: number;
  failureMessages?: string[];
  errors?: VitestError[];
}

interface VitestTestResultEntry {
  name?: string;
  status?: string;
  message?: string;
  startTime?: number;
  endTime?: number;
  assertionResults?: VitestAssertionResult[];
}

interface VitestJsonReport {
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
  testResults?: VitestTestResultEntry[];
  coverageMap?: unknown;
  /** Vitest 特有：版本信息 */
  name?: string;
}

function mapStatus(raw: string | undefined): TestStatus {
  switch (raw) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'skipped':
    case 'pending':
    case 'todo':
      return 'skipped';
    default:
      return 'pending';
  }
}

/** 从 Vitest 断言中提取失败信息与堆栈 */
function extractFailure(a: VitestAssertionResult): { message?: string; stack?: string } {
  const failureMessages = Array.isArray(a.failureMessages) ? a.failureMessages.filter(Boolean) : [];
  const errors = Array.isArray(a.errors) ? a.errors : [];
  const messageParts: string[] = [];
  let stack: string | undefined;
  for (const m of failureMessages) {
    messageParts.push(String(m));
  }
  for (const e of errors) {
    const msg = safeString(e?.message);
    if (msg) messageParts.push(msg);
    const st = safeString(e?.stack);
    if (st && stack === undefined) stack = st;
  }
  return {
    message: messageParts.length > 0 ? messageParts.join('\n') : undefined,
    stack,
  };
}

export class VitestJsonParser implements TestResultParser {
  readonly name = 'vitest';

  canParse(filePath: string, content: string): boolean {
    const looksJson = filePath.toLowerCase().endsWith('.json');
    if (!looksJson) return false;
    try {
      const data = JSON.parse(content) as VitestJsonReport;
      // Vitest JSON 强特征：存在 testResults 数组，且断言可能含 errors 字段
      // 若有 errors 字段则更可能是 Vitest；否则与 Jest 难以区分，交由 Jest 先匹配
      // 注册顺序为 Jest -> Vitest -> JUnit，此处仅在 Jest 未命中时兜底
      const hasTestResults = Array.isArray(data.testResults);
      const hasVitestMarker = data.name === 'vitest' || safeRead(data, 'vitest') !== undefined;
      return hasTestResults && hasVitestMarker;
    } catch {
      return false;
    }
  }

  parse(filePath: string, content: string): TestResult {
    let data: VitestJsonReport;
    try {
      data = JSON.parse(content) as VitestJsonReport;
    } catch (e) {
      throw new Error(`Vitest JSON 解析失败：内容不是合法 JSON。${e instanceof Error ? e.message : ''}`);
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
        const failInfo = extractFailure(a);
        const rawMessage = failInfo.message || (entry.message && status !== 'passed' ? entry.message : undefined);
        const { errorMessage, stackTrace } = sanitizeFailure(rawMessage, failInfo.stack);
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
      const start = safeNumber(entry.startTime);
      const end = safeNumber(entry.endTime);
      const suiteDuration = start !== undefined && end !== undefined && end >= start ? end - start : undefined;
      suites.push({
        title: file || '(未知测试文件)',
        cases,
        ...(suiteDuration !== undefined ? { durationMs: suiteDuration } : {}),
      });
    }

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

    const totalDuration = hasDurationData
      ? suites.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) || undefined
      : undefined;
    if (totalDuration === undefined) {
      warnings.push('总耗时未获取（Vitest JSON 未提供 duration 字段）');
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
