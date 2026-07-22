/**
 * JUnit XML 解析器（T1.6，跨语言兜底格式）
 *
 * 解析 JUnit XML（<testsuite> / <testcase> / <failure>）→ TestResultModel
 * 支持 <testsuites> 包裹或裸 <testsuite>，兼容 pytest JUnit XML（QD2）
 *
 * 无内建 XML 解析器，使用轻量级正则提取（满足 NFR1 性能约束）
 * 必选字段缺失（tests/failures 属性）→ 抛错（AC4）
 */
import type {
  TestResultModel,
  TestFailure,
  TestDetailGroup,
  TestCase,
} from '../types';
import { MAX_STACK_LINES, TOOL_VERSION } from '../types';
import type { TestResultParser } from './registry';

/** 提取 XML 属性值 */
function getAttr(
  tag: string,
  attr: string
): string | undefined {
  const m = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`).exec(tag);
  return m ? m[1] : undefined;
}

/** 提取标签内部文本 */
function getInnerXML(
  xml: string,
  tagName: string,
  startIdx: number
): { text: string; endIdx: number } | null {
  const open = `<${tagName}`;
  const close = `</${tagName}>`;
  const openIdx = xml.indexOf(open, startIdx);
  if (openIdx === -1) return null;
  // 找到对应 open tag 的结束 >
  const tagEnd = xml.indexOf('>', openIdx);
  if (tagEnd === -1) return null;
  // self-closing?
  if (xml[tagEnd - 1] === '/') {
    return { text: '', endIdx: tagEnd + 1 };
  }
  const closeIdx = xml.indexOf(close, tagEnd);
  if (closeIdx === -1) return null;
  return {
    text: xml.substring(tagEnd + 1, closeIdx),
    endIdx: closeIdx + close.length,
  };
}

function truncateStack(stackText: string, maxLines: number): string[] {
  const lines = stackText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines), `...（截断，共 ${lines.length} 行）`];
}

/** 解析所有 testcase 元素 */
function parseTestCases(
  suiteText: string
): Array<{ tag: string; name: string; classname: string; time: string; failureText: string; failureMsg: string }> {
  const results: Array<{
    tag: string;
    name: string;
    classname: string;
    time: string;
    failureText: string;
    failureMsg: string;
  }> = [];

  const regex = /<testcase\b[^>]*\/?>(?:([\s\S]*?)<\/testcase>)?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(suiteText)) !== null) {
    const fullTag = m[0];
    const inner = m[1] ?? '';
    const name = getAttr(fullTag, 'name') ?? '<未命名用例>';
    const classname = getAttr(fullTag, 'classname') ?? '<未知类>';
    const time = getAttr(fullTag, 'time') ?? '0';

    let failureText = '';
    let failureMsg = '';
    // 提取 <failure> 或 <error> 子元素
    const failMatch = /<(?:failure|error)\b([^>]*)\/?>(?:([\s\S]*?)<\/(?:failure|error)>)?/.exec(
      inner
    );
    if (failMatch) {
      failureMsg = getAttr(failMatch[1] ?? '', 'message') ?? '';
      failureText = (failMatch[2] ?? '').trim();
    }
    // self-closing failure
    if (!failureText && !failureMsg) {
      const failSelf = /<(?:failure|error)\b([^>]*)\/>/.exec(inner);
      if (failSelf) {
        failureMsg = getAttr(failSelf[1] ?? '', 'message') ?? '';
      }
    }
    // skipped 标记
    const skipMatch = /<skipped\b/.exec(inner);

    results.push({
      tag: fullTag,
      name,
      classname,
      time,
      failureText,
      failureMsg,
    });
  }
  return results;
}

export class JUnitParser implements TestResultParser {
  name = 'junit';

  canHandle(filePath: string, content?: string): boolean {
    const lower = filePath.toLowerCase();
    if (
      (lower.endsWith('.xml') || lower.endsWith('.junit.xml')) &&
      (lower.includes('junit') || lower.includes('test') || lower.includes('pytest'))
    ) {
      if (content) {
        return (
          content.includes('<testsuite') || content.includes('<testsuites')
        );
      }
      return true;
    }
    if (content) {
      return content.includes('<testsuite') || content.includes('<testsuites');
    }
    return false;
  }

  parse(raw: string): TestResultModel {
    const xml = raw.trim();
    if (!xml.includes('<testsuite') && !xml.includes('<testsuites')) {
      throw new Error(
        '[junit-parser] 结果文件不是合法 JUnit XML：缺少 <testsuite> 元素。'
      );
    }

    let total = 0;
    let failed = 0;
    let skipped = 0;
    let durationMs = 0;
    const details: TestDetailGroup[] = [];
    const failures: TestFailure[] = [];

    // 提取所有 testsuite（支持 <testsuites> 包裹或裸 <testsuite>）
    let searchIdx = 0;
    let suiteResult: { text: string; endIdx: number } | null;
    let suiteFound = false;

    while (
      (suiteResult = getInnerXML(xml, 'testsuite', searchIdx)) !== null
    ) {
      suiteFound = true;
      // 获取 testsuite 标签本身（含属性）
      const suiteTagEnd = xml.lastIndexOf('<testsuite', suiteResult.endIdx);
      // 从 suiteText 之前的 tag 提取属性
      const tagSearchStart = Math.max(0, suiteTagEnd);
      const tagClose = xml.indexOf('>', tagSearchStart);
      const suiteTag = xml.substring(tagSearchStart, tagClose + 1);

      const suiteTests = parseInt(getAttr(suiteTag, 'tests') ?? '0', 10) || 0;
      const suiteFailures =
        parseInt(getAttr(suiteTag, 'failures') ?? '0', 10) || 0;
      const suiteErrors = parseInt(getAttr(suiteTag, 'errors') ?? '0', 10) || 0;
      const suiteSkipped =
        parseInt(getAttr(suiteTag, 'skipped') ?? '0', 10) || 0;
      const suiteTime = parseFloat(getAttr(suiteTag, 'time') ?? '0') || 0;

      // 若属性缺失，则按 testcase 计数
      const testCases = parseTestCases(suiteResult.text);

      if (suiteTests > 0) {
        total += suiteTests;
      } else {
        total += testCases.length;
      }
      failed += suiteFailures + suiteErrors;
      skipped += suiteSkipped;
      durationMs += suiteTime * 1000; // 秒转毫秒

      // 按文件分组
      const groupMap = new Map<string, TestCase[]>();
      for (const tc of testCases) {
        // classname 通常含文件路径
        const filePath = this.extractFilePath(tc.classname);
        const duration = parseFloat(tc.time) * 1000;
        const isFailed = tc.failureText || tc.failureMsg;
        const isSkipped = /<skipped\b/.test(
          suiteResult.text.substring(
            suiteResult.text.indexOf(tc.tag),
            suiteResult.text.indexOf(tc.tag) + tc.tag.length + 200
          )
        );
        const status: TestCase['status'] = isFailed
          ? 'failed'
          : isSkipped
          ? 'skipped'
          : 'passed';

        const caseObj: TestCase = {
          name: tc.name,
          durationMs: Math.round(duration),
          status,
        };

        if (!groupMap.has(filePath)) groupMap.set(filePath, []);
        groupMap.get(filePath)!.push(caseObj);

        // 提取失败用例
        if (isFailed) {
          const errMsg = tc.failureMsg || tc.failureText || '未获取到错误信息';
          failures.push({
            testName: tc.name,
            filePath,
            errorMessage: errMsg,
            stackTrace: truncateStack(
              tc.failureText || tc.failureMsg,
              MAX_STACK_LINES
            ),
          });
        }
      }

      for (const [fp, cases] of groupMap) {
        details.push({ filePath: fp, cases });
      }

      searchIdx = suiteResult.endIdx;
    }

    if (!suiteFound) {
      throw new Error(
        '[junit-parser] 结果文件未包含任何 <testsuite> 元素，无法生成报告。'
      );
    }

    // 必选字段校验
    if (total === 0 && failed === 0) {
      // 尝试从 testcase 计数兜底
      const allCases = parseTestCases(xml);
      if (allCases.length > 0) {
        total = allCases.length;
      }
    }

    if (total === 0) {
      throw new Error(
        '[junit-parser] 缺少必选字段 tests（用例总数），无法生成报告。'
      );
    }

    const passed = total - failed - skipped;
    const passRate =
      total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

    // 确定性排序
    details.sort((a, b) => a.filePath.localeCompare(b.filePath));
    failures.sort((a, b) =>
      `${a.filePath}::${a.testName}`.localeCompare(`${b.filePath}::${b.testName}`)
    );

    return {
      header: {
        projectName: this.detectProjectName(),
        generatedAt: new Date().toISOString(),
        executedCommand: 'parse-only: <junit-xml>',
        framework: 'junit',
        frameworkVersion: undefined,
        environment: {
          os: process.platform,
          runtime: `Node ${process.version}`,
        },
      },
      summary: {
        total,
        passed: passed < 0 ? 0 : passed,
        failed,
        skipped,
        passRate,
        durationMs: Math.round(durationMs),
      },
      failures,
      details,
      coverage: undefined,
      appendix: {
        sourceResultFile: '<junit-xml>',
        toolVersion: TOOL_VERSION,
      },
    };
  }

  /** 从 classname 提取文件路径（如 com.example.FooTest → com/example/FooTest） */
  private extractFilePath(classname: string): string {
    // pytest classname 通常是文件路径::类名
    if (classname.includes('::')) {
      return classname.split('::')[0];
    }
    // Java 风格：com.example.FooTest
    return classname.replace(/\./g, '/');
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
