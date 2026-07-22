/**
 * 统一中间数据模型 TestResultModel
 *
 * 所有解析器输出此接口，报告生成器只消费此模型。
 * 字段分为「必选」与「可选」两级（D6 降级策略）：
 *  - 必选字段缺失 → 解析失败，抛出明确错误（AC4）
 *  - 可选字段缺失 → 填 undefined，报告标注「未获取」（NFR2）
 */

/** 报告头（FR2.1） */
export interface TestReportHeader {
  projectName: string;
  /** ISO 8601，报告生成时刻 */
  generatedAt: string;
  /** 执行的测试命令或 "parse-only: <file>" */
  executedCommand: string;
  /** "jest" | "vitest" | "pytest" | "junit" */
  framework: string;
  /** 可选：框架版本，缺失标注「未获取」 */
  frameworkVersion?: string;
  /** 可选：执行环境，缺失标注「未获取」 */
  environment?: {
    os?: string;
    runtime?: string;
  };
}

/** 结果摘要（FR2.2） */
export interface TestReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  /** 百分比，1 位小数 */
  passRate: number;
  /** 总耗时毫秒 */
  durationMs: number;
}

/** 失败用例（FR2.3） */
export interface TestFailure {
  testName: string;
  filePath: string;
  errorMessage: string;
  /** 已截断，默认 20 行 */
  stackTrace: string[];
}

/** 用例明细项（FR2.4） */
export interface TestCase {
  name: string;
  durationMs: number;
  status: 'passed' | 'failed' | 'skipped';
}

/** 按测试文件分组的用例明细（FR2.4） */
export interface TestDetailGroup {
  filePath: string;
  cases: TestCase[];
}

/** 覆盖率（FR2.5，可选） */
export interface TestCoverage {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  /** 低于阈值的文件清单（相对路径） */
  belowThresholdFiles?: string[];
}

/** 附录（FR2.6） */
export interface TestAppendix {
  sourceResultFile: string;
  /** Skill 版本 */
  toolVersion: string;
}

/** 统一中间数据模型 */
export interface TestResultModel {
  header: TestReportHeader;
  summary: TestReportSummary;
  failures: TestFailure[];
  details: TestDetailGroup[];
  /** 缺失时为 undefined，报告标注「未获取」 */
  coverage?: TestCoverage;
  appendix: TestAppendix;
}

/** 用例状态 */
export type CaseStatus = 'passed' | 'failed' | 'skipped';

/** Skill 配置项（FR4.2，D7 配置合并优先级） */
export interface TestReportConfig {
  /** 测试执行命令，默认 "auto" 自动检测 */
  testCommand?: string;
  /** 解析模式下的结果文件路径；指定时进入解析模式 */
  resultFile?: string;
  /** 输出格式：markdown / html / json，默认 markdown */
  outputFormat?: 'markdown' | 'html' | 'json';
  /** 报告输出目录，默认 reports/ */
  outputPath?: string;
  /** 覆盖率：auto / on / off，默认 auto */
  coverage?: 'auto' | 'on' | 'off';
  /** 通过率低于该百分比时报告结论标记为不达标，默认不启用 */
  failThreshold?: number;
}

export const DEFAULT_CONFIG: Required<
  Omit<TestReportConfig, 'testCommand' | 'resultFile' | 'failThreshold'>
> & {
  testCommand: string;
  failThreshold: number | undefined;
} = {
  testCommand: 'auto',
  resultFile: undefined,
  outputFormat: 'markdown',
  outputPath: 'reports/',
  coverage: 'auto',
  failThreshold: undefined,
};

/** Skill 版本号 */
export const TOOL_VERSION = '1.0.0';

/** 默认堆栈截断行数（FR2.3） */
export const MAX_STACK_LINES = 20;

/** 用例明细截断阈值（FR2.4） */
export const MAX_DETAIL_CASES = 200;
