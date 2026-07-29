/**
 * test-report-generator 主入口
 *
 * 编排执行模式 / 解析模式（FR1.3）：
 *   - 解析模式：用户提供 resultFile，直接读取 -> 解析 -> 生成报告
 *   - 执行模式：自动识别框架与命令 -> 执行测试 -> 收集结果 -> 解析 -> 生成报告
 *
 * 错误处理（FR1.4）：命令无法运行时给出明确诊断信息，不得生成空报告冒充成功。
 * 健壮性（NFR2）：结果文件异常降级输出，不崩溃。
 *
 * 运行方式：
 *   node --loader ts-node/esm scripts/index.ts --resultFile <path> [--format markdown] [--output reports/] [--coverage auto]
 *   node --loader ts-node/esm scripts/index.ts --execute [--command "..."] [--cwd .]
 *
 * 也可作为库被 Agent 引入：
 *   import { generateReport } from './index.ts';
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import { createDefaultParsers, ParserRegistry } from './parser-registry.ts';
import { generateMarkdownReport } from './markdown-reporter.ts';
import { detectFramework } from './framework-detect.ts';
import type { ReportConfig, ReportOutput, TestResult } from './types.ts';

export const TOOL_VERSION = '1.0.0';

export interface GenerateOptions {
  /** 工作目录 */
  cwd?: string;
  /** 解析模式：指定结果文件路径 */
  resultFile?: string;
  /** 执行模式：用户指定测试命令（不指定则自动识别） */
  testCommand?: string;
  /** 是否执行模式 */
  execute?: boolean;
  /** 输出格式 */
  outputFormat?: 'markdown' | 'html' | 'json';
  /** 输出目录 */
  outputPath?: string;
  /** 覆盖率处理 */
  coverage?: 'auto' | 'on' | 'off';
  /** 通过率阈值 */
  failThreshold?: number;
  /** 项目名 */
  projectName?: string;
  /** 注入的解析器注册表（测试用） */
  registry?: ParserRegistry;
}

/**
 * 生成测试报告（库 API）。
 * 根据是否提供 resultFile / execute 决定模式：
 *   - 提供 resultFile 且非 execute：解析模式
 *   - execute 或仅提供 testCommand：执行模式
 */
export async function generateReport(options: GenerateOptions): Promise<ReportOutput> {
  const cwd = options.cwd ?? process.cwd();
  const config: ReportConfig = {
    testCommand: options.testCommand,
    resultFile: options.resultFile,
    outputFormat: options.outputFormat ?? 'markdown',
    outputPath: options.outputPath ?? 'reports/',
    coverage: options.coverage ?? 'auto',
    failThreshold: options.failThreshold,
    projectName: options.projectName,
  };
  const registry = options.registry ?? createDefaultParsers();
  const diagnostics: string[] = [];

  // 判定模式
  const executeMode = options.execute === true || (options.testCommand !== undefined && options.resultFile === undefined);

  let resultFile = options.resultFile;
  let executedCommand: string | undefined;
  let envSummary: string | undefined;

  if (executeMode) {
    // ===== 执行模式 =====
    const detection = detectFramework(cwd, options.testCommand);
    if (detection.framework === 'unknown' && !options.testCommand) {
      // FR1.4：无法识别命令时给出明确诊断，不得生成空报告
      throw new Error(
        `无法识别测试框架与运行命令。${detection.detectionSource}。请显式指定 testCommand，或确保项目包含 jest/vitest/pytest 配置。`,
      );
    }
    executedCommand = detection.testCommand;
    if (detection.frameworkVersion) {
      // 框架版本保留用于报告头
    }
    envSummary = `Node ${process.version} / ${os.platform()} ${os.release()}`;

    // 执行测试命令（同步，超时 600s）
    const start = Date.now();
    try {
      execSync(executedCommand, {
        cwd,
        encoding: 'utf8',
        timeout: 600000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; status?: number; message?: string };
      // 测试命令执行本身失败（非用例失败，而是命令无法运行或框架崩溃）
      // Jest/Vitest 在用例失败时 exitCode 非 0，但结果文件仍会生成，需区分
      const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      const durationMs = Date.now() - start;
      // 若结果文件已生成，则视为"用例失败"而非"命令无法运行"
      resultFile = detection.resultFile || resultFile;
      const fileReady = resultFile && fs.existsSync(resultFile);
      if (!fileReady) {
        // FR1.4：命令无法运行，不得生成空报告
        throw new Error(
          `测试命令执行失败（命令无法运行），不生成报告。退出码：${err.status ?? '未知'}。` +
            `诊断：${(err.message ?? '').slice(0, 300)}。输出末尾：${out.slice(-500)}` +
            `耗时：${durationMs}ms`,
        );
      }
      // 结果文件已生成：继续解析（用例失败属正常情况）
      diagnostics.push(`测试命令退出码非 0（${err.status ?? '未知'}），存在用例失败，继续生成报告。`);
    }
    resultFile = resultFile ?? detection.resultFile;
  }

  if (!resultFile) {
    throw new Error('未指定结果文件路径，且无法自动检测。请通过 --resultFile 或在执行模式下运行。');
  }

  if (!fs.existsSync(resultFile)) {
    throw new Error(`结果文件不存在：${resultFile}。请确认测试执行是否成功落盘结果文件。`);
  }

  // ===== 读取并解析结果 =====
  let content: string;
  try {
    content = fs.readFileSync(resultFile, 'utf8');
  } catch (e) {
    throw new Error(`结果文件读取失败：${resultFile}。${e instanceof Error ? e.message : ''}`);
  }

  let result: TestResult;
  try {
    result = registry.parse(resultFile, content);
  } catch (e) {
    // AC4：结果文件损坏时返回明确错误而非空报告
    throw new Error(`结果文件解析失败：${resultFile}。${e instanceof Error ? e.message : ''}。请检查文件格式或配置正确的 reporter。`);
  }

  // 覆盖率处理（auto：尝试读取 coverage 目录；off：跳过；on：要求但不报错）
  if (config.coverage !== 'off') {
    const coverageResult = tryReadCoverage(cwd, executeMode ? path.dirname(resultFile) : cwd);
    if (coverageResult) {
      result = { ...result, coverage: coverageResult };
    } else if (config.coverage === 'auto') {
      result.warnings.push('覆盖率数据未获取（未找到 coverage-summary.json）');
    }
  }

  // ===== 生成报告 =====
  if (config.outputFormat === 'html') {
    // P1：HTML 输出 —— P0 阶段降级为 Markdown 并标注
    diagnostics.push('HTML 输出为 P1 能力，当前降级为 Markdown 输出。');
    config.outputFormat = 'markdown';
  }

  const reportInput = {
    result,
    config,
    envSummary,
    toolVersion: TOOL_VERSION,
    executedCommand,
    projectName: config.projectName,
  };

  const mdOutput = generateMarkdownReport(reportInput);
  diagnostics.push(...result.warnings);

  // 确保输出目录存在并落盘
  const outDir = config.outputPath.replace(/\/$/, '');
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.resolve(outDir, path.basename(mdOutput.reportPath));
  fs.writeFileSync(reportPath, mdOutput.content, 'utf8');

  let jsonPath: string | undefined;
  if (mdOutput.jsonContent) {
    jsonPath = path.resolve(outDir, path.basename(mdOutput.jsonPath ?? ''));
    fs.writeFileSync(jsonPath, mdOutput.jsonContent, 'utf8');
  }

  // ===== 构造回显摘要（FR3.3） =====
  const conclusion = result.failed === 0 && (config.failThreshold === undefined || result.passRate >= config.failThreshold) ? 'pass' : 'fail';
  const topFailures: string[] = [];
  for (const suite of result.suites) {
    for (const tc of suite.cases) {
      if (tc.status === 'failed' || tc.status === 'error') {
        const reason = `${tc.file ? `[${tc.file}] ` : ''}${tc.name}${tc.errorMessage ? `: ${tc.errorMessage.slice(0, 120)}` : ''}`;
        topFailures.push(reason);
        if (topFailures.length >= 3) break;
      }
    }
    if (topFailures.length >= 3) break;
  }

  return {
    reportPath,
    jsonPath,
    summary: {
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      passRate: result.passRate,
      conclusion,
      topFailures,
    },
    diagnostics,
  };
}

/**
 * 尝试读取覆盖率数据（Jest/Vitest 的 coverage-summary.json）。
 * 失败返回 undefined（降级，不报错）。
 */
function tryReadCoverage(cwd: string, fallbackDir: string): TestResult['coverage'] {
  const candidates = [
    path.join(cwd, 'coverage', 'coverage-summary.json'),
    path.join(cwd, 'coverage', 'coverage-final.json'),
    path.join(fallbackDir, 'coverage', 'coverage-summary.json'),
  ];
  let summaryPath: string | undefined;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      summaryPath = c;
      break;
    }
  }
  if (!summaryPath) return undefined;

  try {
    const raw = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    // coverage-summary.json 结构：{ total: { statements: {pct}, branches:{pct}, functions:{pct}, lines:{pct} }, "<file>": {...} }
    const total = raw.total ?? {};
    const statements = typeof total.statements?.pct === 'number' ? total.statements.pct : undefined;
    const branches = typeof total.branches?.pct === 'number' ? total.branches.pct : undefined;
    const functions = typeof total.functions?.pct === 'number' ? total.functions.pct : undefined;
    const lines = typeof total.lines?.pct === 'number' ? total.lines.pct : undefined;
    const lowCoverageFiles: NonNullable<TestResult['coverage']>['lowCoverageFiles'] = [];
    for (const [file, cov] of Object.entries(raw)) {
      if (file === 'total') continue;
      if (!cov || typeof cov !== 'object') continue;
      const c = cov as { statements?: { pct?: number }; branches?: { pct?: number }; functions?: { pct?: number }; lines?: { pct?: number } };
      // 低覆盖阈值默认 80%
      const sPct = c.statements?.pct;
      if (sPct !== undefined && sPct < 80) {
        lowCoverageFiles.push({
          file,
          statements: sPct,
          branches: c.branches?.pct,
          functions: c.functions?.pct,
          lines: c.lines?.pct,
        });
      }
    }
    return { statements, branches, functions, lines, lowCoverageFiles };
  } catch {
    return undefined;
  }
}

// ===== CLI 入口 =====
function parseArgs(argv: string[]): GenerateOptions {
  const opts: GenerateOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--resultFile':
      case '-r':
        opts.resultFile = argv[++i];
        break;
      case '--command':
      case '-c':
        opts.testCommand = argv[++i];
        break;
      case '--execute':
      case '-e':
        opts.execute = true;
        break;
      case '--format':
      case '-f':
        opts.outputFormat = argv[++i] as 'markdown' | 'html' | 'json';
        break;
      case '--output':
      case '-o':
        opts.outputPath = argv[++i];
        break;
      case '--coverage':
        opts.coverage = argv[++i] as 'auto' | 'on' | 'off';
        break;
      case '--failThreshold':
        opts.failThreshold = Number(argv[++i]);
        break;
      case '--cwd':
        opts.cwd = argv[++i];
        break;
      case '--projectName':
        opts.projectName = argv[++i];
        break;
      default:
        break;
    }
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const output = await generateReport(opts);
    const conc = output.summary.conclusion === 'pass' ? '✅ 通过' : '❌ 未通过';
    console.log('===== 测试报告生成完成 =====');
    console.log(`报告路径：${output.reportPath}`);
    if (output.jsonPath) console.log(`JSON 产物：${output.jsonPath}`);
    console.log(`结果：${conc}`);
    console.log(
      `摘要：总数 ${output.summary.total}，通过 ${output.summary.passed}，失败 ${output.summary.failed}，跳过 ${output.summary.skipped}，通过率 ${output.summary.passRate}%`,
    );
    if (output.summary.topFailures.length > 0) {
      console.log('关键失败原因：');
      for (const f of output.summary.topFailures) {
        console.log(`  - ${f}`);
      }
    }
    if (output.diagnostics.length > 0) {
      console.log('诊断提示：');
      for (const d of output.diagnostics) {
        console.log(`  - ${d}`);
      }
    }
  } catch (e) {
    console.error('===== 测试报告生成失败 =====');
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}

// 仅在直接运行时执行 CLI（ESM 兼容：通过入口文件判断）
// 注意：Node --experimental-strip-types 下 require.main 不可用，改用 import.meta.url
const isDirectRun = (() => {
  try {
    const entry = process.argv[1] ?? '';
    const url = import.meta.url;
    // 入口路径与当前文件路径一致即为直接运行
    const entryUrl = url.startsWith('file://') ? url : new URL(`file://${entry}`).href;
    return entry !== '' && (entryUrl.endsWith('/index.ts') || entry.endsWith('index.ts'));
  } catch {
    return false;
  }
})();
if (isDirectRun) {
  void main();
}

// 导出用于 Agent 库调用与测试
export { createDefaultParsers, ParserRegistry } from './parser-registry.ts';
export { generateMarkdownReport } from './markdown-reporter.ts';
export { detectFramework } from './framework-detect.ts';
export * from './types.ts';
