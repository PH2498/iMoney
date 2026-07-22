/**
 * 安全过滤器（T1.9）
 *
 * 设计决策 D3：在 TestResultModel 产出后、报告生成前统一运行。
 * 过滤：
 *  - 环境变量模式：process.env.* / $ENV_*
 *  - 密钥模式：password=... / token=... / Bearer ... / AKIA[0-9A-Z]{16}
 *  - 敏感路径：$HOME / /Users/<name> / C:\Users\<name> → <redacted>
 *
 * 纯函数，无副作用，易于测试（NFR3）
 */
import * as os from 'os';
import type { TestResultModel, TestFailure } from '../types';

/** 敏感模式匹配规则 */
const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // 环境变量
  { pattern: /process\.env\.\w+/g, replacement: '<redacted-env>', label: 'ENV' },
  { pattern: /\$ENV_[A-Z_]+/g, replacement: '<redacted-env>', label: 'ENV' },
  // 密钥模式
  { pattern: /(password|passwd|pwd)\s*[=:]\s*[^\s,;"'`)]+/gi, replacement: '$1=<redacted>', label: 'PASSWORD' },
  { pattern: /(token|apikey|api_key|secret)\s*[=:]\s*[^\s,;"'`)]+/gi, replacement: '$1=<redacted>', label: 'TOKEN' },
  { pattern: /Bearer\s+[A-Za-z0-9._\-]+/g, replacement: 'Bearer <redacted>', label: 'BEARER' },
  // AWS Access Key
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '<redacted-aws-key>', label: 'AWS_KEY' },
  // 私钥
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g, replacement: '<redacted-private-key>', label: 'PRIVATE_KEY' },
  // JWT
  { pattern: /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, replacement: '<redacted-jwt>', label: 'JWT' },
];

/** 敏感路径模式 */
function buildPathPatterns(): Array<{ pattern: RegExp; replacement: string }> {
  const home = os.homedir();
  const patterns: Array<{ pattern: RegExp; replacement: string }> = [];

  if (home && home.length > 0) {
    // 转义 home 路径中的特殊字符
    const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    patterns.push({
      pattern: new RegExp(escaped, 'g'),
      replacement: '<redacted-home>',
    });
  }

  // Unix /Users/<name>
  patterns.push({
    pattern: /\/Users\/[^/]+/g,
    replacement: '/Users/<redacted>',
  });
  // Windows C:\Users\<name>
  patterns.push({
    pattern: /C:\\Users\\[^\\]+/g,
    replacement: 'C:\\Users\\<redacted>',
  });
  // $HOME 变量
  patterns.push({
    pattern: /\$HOME/g,
    replacement: '<redacted-home>',
  });

  return patterns;
}

/** 过滤单段文本 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const rule of SECRET_PATTERNS) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  for (const rule of buildPathPatterns()) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

/** 过滤堆栈数组 */
function sanitizeStack(stack: string[]): string[] {
  return stack.map((line) => sanitizeText(line));
}

/** 过滤失败用例 */
function sanitizeFailures(failures: TestFailure[]): TestFailure[] {
  return failures.map((f) => ({
    testName: sanitizeText(f.testName),
    filePath: sanitizeText(f.filePath),
    errorMessage: sanitizeText(f.errorMessage),
    stackTrace: sanitizeStack(f.stackTrace),
  }));
}

/**
 * 对 TestResultModel 执行安全过滤（NFR3）
 * 在报告生成前强制运行（D3）
 */
export function applySecurityFilter(model: TestResultModel): TestResultModel {
  return {
    header: {
      ...model.header,
      // executedCommand 须脱敏（Security Considerations）
      executedCommand: sanitizeText(model.header.executedCommand),
      projectName: sanitizeText(model.header.projectName),
    },
    summary: model.summary, // 纯数字，无需过滤
    failures: sanitizeFailures(model.failures),
    details: model.details.map((g) => ({
      filePath: sanitizeText(g.filePath),
      cases: g.cases.map((c) => ({
        ...c,
        name: sanitizeText(c.name),
      })),
    })),
    coverage: model.coverage
      ? {
          ...model.coverage,
          belowThresholdFiles: model.coverage.belowThresholdFiles?.map((f) =>
            sanitizeText(f)
          ),
        }
      : undefined,
    appendix: {
      ...model.appendix,
      sourceResultFile: sanitizeText(model.appendix.sourceResultFile),
    },
  };
}
