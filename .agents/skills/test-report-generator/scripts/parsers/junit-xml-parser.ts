/**
 * JUnit XML 解析器（跨语言兜底格式）。
 *
 * JUnit XML 核心结构：
 *   <testsuites tests=".." failures=".." errors=".." skipped=".." time="..">
 *     <testsuite name=".." tests=".." failures=".." errors=".." skipped=".." time=".." timestamp=".." file="..">
 *       <testcase name=".." classname=".." time="..">
 *         <failure message=".." type="..">堆栈文本</failure>
 *         <error message=".." type="..">堆栈文本</error>
 *         <skipped message=".."/>
 *         <system-out>..</system-out>
 *         <system-err>..</system-err>
 *       </testcase>
 *     </testsuite>
 *   </testsuites>
 *
 * 零依赖解析：Node 无内置 DOMParser，本解析器用轻量正则 + 状态机解析，
 * 满足 NFR1（5 秒内 1000 用例）与 NFR2（格式异常降级）。
 * 不引入第三方依赖（保持 Skill 自包含，便于 Agent 运行时复用）。
 */
import type { TestCase, TestResult, TestResultParser, TestStatus } from '../types.ts';
import { safeNumber, safeString, sanitizeFailure, redactSensitive, truncateMessage } from '../security.ts';

interface RawTestCase {
  name?: string;
  classname?: string;
  time?: string;
  status?: string;
  failureMessage?: string;
  failureText?: string;
  errorMessage?: string;
  errorText?: string;
  skippedMessage?: string;
  file?: string;
}

/** 从标签文本中提取纯文本（仅剥离子标签，保留堆栈中的合法尖括号文本如 <anonymous>） */
function extractText(inner: string): string {
  // 仅剥离子标签：failure/error/skipped/system-out/system-err，避免误伤堆栈中的 <anonymous> 等
  let text = inner.replace(/<\/?(failure|error|skipped|system-out|system-err)\b[^>]*>/gi, '');
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function mapStatus(tc: RawTestCase): TestStatus {
  if (tc.failureMessage !== undefined || tc.failureText !== undefined) return 'failed';
  if (tc.errorMessage !== undefined || tc.errorText !== undefined) return 'error';
  if (tc.skippedMessage !== undefined) return 'skipped';
  return 'passed';
}

export class JUnitXmlParser implements TestResultParser {
  readonly name = 'junit';

  canParse(filePath: string, content: string): boolean {
    const looksXml = filePath.toLowerCase().endsWith('.xml');
    if (!looksXml) return false;
    // JUnit XML 强特征：根标签 testsuites 或 testsuite
    return /<testsuites[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
  }

  parse(filePath: string, content: string): TestResult {
    const warnings: string[] = [];
    const suites: TestSuite[] = [];
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let totalDurationMs: number | undefined;

    // 解析顶层 testsuites 属性（汇总兜底）
    const rootMatch = content.match(/<testsuites\b([^>]*)>/i);
    const rootAttr = rootMatch ? rootMatch[1] ?? '' : '';
    const rootTests = readAttr(rootAttr, 'tests');
    const rootFailures = readAttr(rootAttr, 'failures');
    const rootErrors = readAttr(rootAttr, 'errors');
    const rootSkipped = readAttr(rootAttr, 'skipped');
    const rootTime = readAttr(rootAttr, 'time');

    // 提取每个 testsuite 块
    const suiteRegex = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/gi;
    let suiteMatch: RegExpExecArray | null;
    while ((suiteMatch = suiteRegex.exec(content)) !== null) {
      const suiteAttr = suiteMatch[1] ?? '';
      const suiteInner = suiteMatch[2] ?? '';
      const suiteName = safeString(readAttr(suiteAttr, 'name')) ?? '(未命名套件)';
      const suiteFile = safeString(readAttr(suiteAttr, 'file')) ?? '';
      const suiteTime = safeNumber(readAttr(suiteAttr, 'time'));
      const cases: TestCase[] = [];

      // 提取每个 testcase 块。
      // 分两遍处理以避免可选 group 导致的跨用例串扰：
      //   1. 含 body 形式：<testcase ...>...</testcase>
      //   2. 自闭合形式：<testcase .../>
      const tcBodyRegex = /<testcase\b([^>]*?)>([\s\S]*?)<\/testcase>/gi;
      const tcSelfRegex = /<testcase\b([^>]*?)\/>/gi;
      // 先收集含 body 用例及其起始偏移，避免与自闭合计数重叠
      const bodyCases: Array<{ attr: string; body: string; index: number; end: number }> = [];
      let tcMatch: RegExpExecArray | null;
      while ((tcMatch = tcBodyRegex.exec(suiteInner)) !== null) {
        bodyCases.push({ attr: tcMatch[1] ?? '', body: tcMatch[2] ?? '', index: tcMatch.index, end: tcMatch.index + tcMatch[0].length });
      }
      // 自闭合并例：跳过已被含 body 正则覆盖的范围
      const selfCases: Array<{ attr: string }> = [];
      while ((tcMatch = tcSelfRegex.exec(suiteInner)) !== null) {
        const pos = tcMatch.index;
        const inBody = bodyCases.some((b) => pos >= b.index && pos < b.end);
        if (!inBody) selfCases.push({ attr: tcMatch[1] ?? '' });
      }
      // 合并：含 body 在前，自闭合在后，保持大致出现顺序
      const allCases: Array<{ attr: string; body: string }> = [
        ...bodyCases.map((b) => ({ attr: b.attr, body: b.body })),
        ...selfCases.map((s) => ({ attr: s.attr, body: '' })),
      ];
      for (const { attr: tcAttr, body: tcBody } of allCases) {
        const raw: RawTestCase = {
          name: safeString(readAttr(tcAttr, 'name')) ?? undefined,
          classname: safeString(readAttr(tcAttr, 'classname')) ?? undefined,
          time: safeString(readAttr(tcAttr, 'time')) ?? undefined,
          file: safeString(readAttr(tcAttr, 'file')) ?? undefined,
        };

        if (tcBody) {
          // failure / error / skipped 子标签
          const failureMatch = tcBody.match(/<failure\b([^>]*)>([\s\S]*?)<\/failure>/i);
          if (failureMatch) {
            raw.failureMessage = safeString(readAttr(failureMatch[1] ?? '', 'message')) ?? undefined;
            raw.failureText = failureMatch[2] ? safeString(extractText(failureMatch[2])) ?? undefined : undefined;
          }
          const errorMatch = tcBody.match(/<error\b([^>]*)>([\s\S]*?)<\/error>/i);
          if (errorMatch) {
            raw.errorMessage = safeString(readAttr(errorMatch[1] ?? '', 'message')) ?? undefined;
            raw.errorText = errorMatch[2] ? safeString(extractText(errorMatch[2])) ?? undefined : undefined;
          }
          const skippedMatch = tcBody.match(/<skipped\b([^>]*)\/?>/i);
          if (skippedMatch) {
            raw.skippedMessage = safeString(readAttr(skippedMatch[1] ?? '', 'message')) ?? undefined;
          }
        }

        const status = mapStatus(raw);
        // 失败信息：优先 message，其次文本体；堆栈取文本体
        const rawMessage = raw.failureMessage ?? raw.errorMessage ?? raw.failureText ?? raw.errorText;
        const rawStack = raw.failureText ?? raw.errorText;
        const { errorMessage, stackTrace } = sanitizeFailure(rawMessage, rawStack);
        const duration = raw.time !== undefined ? safeNumber(raw.time) : undefined;
        const caseFile = raw.file ?? suiteFile ?? raw.classname ?? '';

        cases.push({
          name: raw.name ?? '(未命名用例)',
          file: caseFile,
          status,
          ...(duration !== undefined ? { durationMs: Math.round(duration * 1000) } : {}),
          ...(errorMessage ? { errorMessage } : {}),
          ...(stackTrace && stackTrace !== errorMessage ? { stackTrace } : {}),
          ...(status === 'skipped' && raw.skippedMessage
            ? { errorMessage: truncateMessage(redactSensitive(raw.skippedMessage)) }
            : {}),
        });

        total += 1;
        if (status === 'passed') passed += 1;
        else if (status === 'failed' || status === 'error') failed += 1;
        else if (status === 'skipped') skipped += 1;
      }

      suites.push({
        title: suiteFile || suiteName,
        cases,
        ...(suiteTime !== undefined ? { durationMs: Math.round(suiteTime * 1000) } : {}),
      });
    }

    // 汇总策略：逐条解析成功时（total>0）优先用逐条精确计数，保证总数/通过/失败/跳过一致；
    // 仅当未解析到任何用例（total===0）时才用 testsuites 顶层属性兜底。
    let finalTotal: number;
    let finalPassed: number;
    let finalFailed: number;
    let finalSkipped: number;
    if (total > 0) {
      finalTotal = total;
      finalPassed = passed;
      finalFailed = failed;
      finalSkipped = skipped;
    } else if (rootTests !== undefined) {
      warnings.push('未解析到 testcase 节点，使用 testsuites 顶层汇总');
      finalTotal = rootTests;
      finalFailed = (rootFailures ?? 0) + (rootErrors ?? 0);
      finalSkipped = rootSkipped ?? 0;
      finalPassed = Math.max(0, finalTotal - finalFailed - finalSkipped);
    } else {
      finalTotal = 0;
      finalPassed = 0;
      finalFailed = 0;
      finalSkipped = 0;
      warnings.push('未解析到任何测试用例或顶层汇总，结果可能为空');
    }

    if (rootTime !== undefined) {
      totalDurationMs = Math.round(rootTime * 1000);
    } else if (total > 0) {
      totalDurationMs = suites.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) || undefined;
    }
    if (totalDurationMs === undefined) {
      warnings.push('总耗时未获取（结果文件未提供 time 字段）');
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
      ...(totalDurationMs !== undefined ? { totalDurationMs } : {}),
      suites,
      warnings,
    };
  }
}

/** 读取属性值：attr="value" 或 attr='value' */
function readAttr(attrString: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i');
  const m = attrString.match(re);
  if (m && m[1] !== undefined) return m[1];
  const re2 = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i');
  const m2 = attrString.match(re2);
  if (m2 && m2[1] !== undefined) return m2[1];
  return undefined;
}
