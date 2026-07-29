/**
 * 框架自动识别 —— 实现 FR1.1（自动识别测试框架与运行命令）与 FR1.3（双模式）。
 *
 * 识别优先级：
 *   a. 用户显式指定的命令（调用方传入 testCommand）；
 *   b. package.json scripts.test / devDependencies 中的 jest|vitest；
 *   c. 框架特征文件推断（jest.config.* / vitest.config.* / pytest.ini）。
 *
 * 设计为纯函数 + 显式 IO 边界（文件读取由调用方传入内容），
 * 便于单元测试与在不同 Agent 运行时复用。
 */
import * as fs from 'fs';
import * as path from 'path';

export interface FrameworkDetection {
  /** 框架标识：jest / vitest / pytest / junit（兜底）/ unknown */
  framework: string;
  /** 推荐的测试执行命令 */
  testCommand: string;
  /** reporter 配置建议（用于让框架输出可解析的结果文件） */
  reporterHint: string;
  /** 推荐的结果文件路径 */
  resultFile: string;
  /** 识别来源说明，用于报告头 */
  detectionSource: string;
  /** 框架版本（若可从依赖推断） */
  frameworkVersion?: string;
}

/** 检查文件是否存在 */
function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/** 读取 JSON 文件，失败返回 null */
function readJson(p: string): Record<string, unknown> | null {
  try {
    const text = fs.readFileSync(p, 'utf8');
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 安全读取依赖版本 */
function readDepVersion(pkg: Record<string, unknown>, depKey: string, name: string): string | undefined {
  const deps = pkg[depKey];
  if (deps === null || typeof deps !== 'object') return undefined;
  const val = (deps as Record<string, unknown>)[name];
  if (typeof val === 'string') {
    // 形如 ^29.0.0 -> 29.0.0
    return val.replace(/^[~^>=\s]+/, '').trim() || undefined;
  }
  return undefined;
}

/** 寻找首个存在的候选路径 */
function firstExisting(dir: string, candidates: string[]): string | undefined {
  for (const c of candidates) {
    const full = path.join(dir, c);
    if (exists(full)) return full;
  }
  return undefined;
}

/**
 * 自动识别框架与执行命令。
 * @param cwd 项目根目录
 * @param userTestCommand 用户显式指定的命令（最高优先级）
 */
export function detectFramework(cwd: string, userTestCommand?: string): FrameworkDetection {
  // a. 用户显式指定
  if (userTestCommand && userTestCommand.trim() !== '') {
    return inferFromCommand(cwd, userTestCommand.trim(), '用户显式指定');
  }

  const pkgPath = path.join(cwd, 'package.json');
  const pkg = readJson(pkgPath);

  // b. package.json scripts.test
  if (pkg) {
    const scripts = pkg['scripts'];
    if (scripts && typeof scripts === 'object') {
      const testScript = (scripts as Record<string, unknown>)['test'];
      if (typeof testScript === 'string' && testScript.trim() !== '' && !/no test specified|echo.*error/i.test(testScript)) {
        // 从 test 脚本推断框架
        const inferred = inferFromCommand(cwd, testScript.trim(), 'package.json scripts.test');
        if (inferred.framework !== 'unknown') {
          return inferred;
        }
      }
    }
  }

  // b/c. 依赖 + 特征文件
  if (pkg) {
    const vitestVer = readDepVersion(pkg, 'devDependencies', 'vitest') ?? readDepVersion(pkg, 'dependencies', 'vitest');
    if (vitestVer) {
      return {
        framework: 'vitest',
        testCommand: 'npx vitest run --reporter=json --outputFile=test-results.json',
        reporterHint: '--reporter=json --outputFile=<file>',
        resultFile: path.join(cwd, 'test-results.json'),
        detectionSource: 'package.json 依赖（vitest）',
        frameworkVersion: vitestVer,
      };
    }
    const jestVer = readDepVersion(pkg, 'devDependencies', 'jest') ?? readDepVersion(pkg, 'dependencies', 'jest');
    if (jestVer) {
      return {
        framework: 'jest',
        testCommand: 'npx jest --json --outputFile=test-results.json',
        reporterHint: '--json --outputFile=<file>',
        resultFile: path.join(cwd, 'test-results.json'),
        detectionSource: 'package.json 依赖（jest）',
        frameworkVersion: jestVer,
      };
    }
  }

  // c. 特征文件
  const vitestCfg = firstExisting(cwd, ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs']);
  if (vitestCfg) {
    return {
      framework: 'vitest',
      testCommand: 'npx vitest run --reporter=json --outputFile=test-results.json',
      reporterHint: '--reporter=json --outputFile=<file>',
      resultFile: path.join(cwd, 'test-results.json'),
      detectionSource: `特征文件 ${path.basename(vitestCfg)}`,
    };
  }
  const jestCfg = firstExisting(cwd, [
    'jest.config.ts',
    'jest.config.js',
    'jest.config.mjs',
    'jest.config.cjs',
  ]);
  if (jestCfg) {
    return {
      framework: 'jest',
      testCommand: 'npx jest --json --outputFile=test-results.json',
      reporterHint: '--json --outputFile=<file>',
      resultFile: path.join(cwd, 'test-results.json'),
      detectionSource: `特征文件 ${path.basename(jestCfg)}`,
    };
  }
  if (exists(path.join(cwd, 'pytest.ini')) || exists(path.join(cwd, 'pyproject.toml'))) {
    return {
      framework: 'pytest',
      testCommand: 'python -m pytest --junitxml=test-results.xml',
      reporterHint: '--junitxml=<file>',
      resultFile: path.join(cwd, 'test-results.xml'),
      detectionSource: '特征文件（pytest）',
    };
  }

  // 兜底：未知框架，提示需用户指定
  return {
    framework: 'unknown',
    testCommand: '',
    reporterHint: '',
    resultFile: '',
    detectionSource: '未识别到已知测试框架',
  };
}

/** 从命令字符串推断框架标识 */
function inferFromCommand(cwd: string, command: string, source: string): FrameworkDetection {
  const cmd = command.toLowerCase();
  if (cmd.includes('vitest')) {
    const outMatch = command.match(/--outputFile[=\s]+(\S+)/);
    return {
      framework: 'vitest',
      testCommand: ensureJsonOutput(command, 'vitest'),
      reporterHint: '--reporter=json --outputFile=<file>',
      resultFile: outMatch ? path.resolve(cwd, outMatch[1]) : path.join(cwd, 'test-results.json'),
      detectionSource: source,
    };
  }
  if (cmd.includes('jest')) {
    const outMatch = command.match(/--outputFile[=\s]+(\S+)/);
    return {
      framework: 'jest',
      testCommand: ensureJsonOutput(command, 'jest'),
      reporterHint: '--json --outputFile=<file>',
      resultFile: outMatch ? path.resolve(cwd, outMatch[1]) : path.join(cwd, 'test-results.json'),
      detectionSource: source,
    };
  }
  if (cmd.includes('pytest')) {
    const outMatch = command.match(/--junitxml[=\s]+(\S+)/);
    return {
      framework: 'pytest',
      testCommand: ensureJunitOutput(command),
      reporterHint: '--junitxml=<file>',
      resultFile: outMatch ? path.resolve(cwd, outMatch[1]) : path.join(cwd, 'test-results.xml'),
      detectionSource: source,
    };
  }
  // 未知命令，原样返回并标注
  return {
    framework: 'unknown',
    testCommand: command,
    reporterHint: '请确保命令输出 Jest/Vitest JSON 或 JUnit XML 结果文件',
    resultFile: '',
    detectionSource: `${source}（框架未识别）`,
  };
}

/** 确保命令包含 JSON 输出参数（缺失则追加） */
function ensureJsonOutput(command: string, framework: 'jest' | 'vitest'): string {
  const hasOutput = /--outputFile[=\s]/i.test(command);
  if (hasOutput) return command;
  const reporterArg = framework === 'vitest' ? '--reporter=json' : '--json';
  return `${command} ${reporterArg} --outputFile=test-results.json`;
}

/** 确保命令包含 JUnit XML 输出参数 */
function ensureJunitOutput(command: string): string {
  const hasOutput = /--junitxml[=\s]/i.test(command);
  if (hasOutput) return command;
  return `${command} --junitxml=test-results.xml`;
}
