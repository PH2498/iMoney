/**
 * test-report-generator
 * 统一数据模型 —— 各框架解析器将原始结果归一化为本模型，
 * 报告生成器只依赖本模型，实现解析层与生成层解耦（依赖倒置）。
 *
 * 设计依据：单一职责 + 开闭原则（新增框架仅新增解析器，不改既有代码）。
 */

/** 单条测试用例状态 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'error';

/** 单条测试用例（归一化后） */
export interface TestCase {
  /** 用例标题，如 `sum should add two numbers` */
  name: string;
  /** 所属测试文件路径，未知则为 '' */
  file: string;
  /** 用例状态 */
  status: TestStatus;
  /** 耗时（毫秒），未知则 undefined，报告中标注「未获取」 */
  durationMs?: number;
  /** 失败/错误信息（已过滤敏感信息） */
  errorMessage?: string;
  /** 堆栈关键行（已截断、已过滤敏感路径/凭据） */
  stackTrace?: string;
  /** 所属套件路径，如 `describe > describe > test`，用于分组 */
  ancestorPath?: string[];
}

/** 一组用例（通常对应一个测试文件或一个 describe 块） */
export interface TestSuite {
  /** 套件标题，通常为测试文件路径或顶层 describe 名 */
  title: string;
  /** 该套件下的用例 */
  cases: TestCase[];
  /** 套件总耗时（毫秒），未知则 undefined */
  durationMs?: number;
}

/** 覆盖率汇总（若可获取） */
export interface CoverageSummary {
  /** 语句覆盖率百分比 */
  statements?: number;
  /** 分支覆盖率百分比 */
  branches?: number;
  /** 函数覆盖率百分比 */
  functions?: number;
  /** 行覆盖率百分比 */
  lines?: number;
  /** 低于阈值的文件清单（文件路径 -> 各指标百分比） */
  lowCoverageFiles?: Array<{
    file: string;
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  }>;
}

/** 归一化后的测试结果（所有解析器的统一产出） */
export interface TestResult {
  /** 测试框架名，如 `jest` / `vitest` / `junit` */
  framework: string;
  /** 框架版本（若原始结果中包含），未知则 undefined */
  frameworkVersion?: string;
  /** 用例总数 */
  total: number;
  /** 通过数 */
  passed: number;
  /** 失败数（含 error） */
  failed: number;
  /** 跳过数 */
  skipped: number;
  /** 通过率百分比（0-100），保留 2 位小数 */
  passRate: number;
  /** 总耗时（毫秒），未知则 undefined */
  totalDurationMs?: number;
  /** 套件列表 */
  suites: TestSuite[];
  /** 覆盖率汇总，不可获取则为 undefined */
  coverage?: CoverageSummary;
  /** 原始结果文件路径 */
  sourceFile: string;
  /** 解析过程中发生的非致命降级提示（如某字段缺失） */
  warnings: string[];
}

/** 报告生成配置 */
export interface ReportConfig {
  /** 测试执行命令；解析模式可为空 */
  testCommand?: string;
  /** 解析模式下的结果文件路径 */
  resultFile?: string;
  /** 输出格式：markdown（默认）/ html / json */
  outputFormat: 'markdown' | 'html' | 'json';
  /** 报告输出目录 */
  outputPath: string;
  /** 覆盖率处理：auto（自动获取）/ on / off */
  coverage: 'auto' | 'on' | 'off';
  /** 通过率阈值百分比；低于该值时结论标记为不达标。不设置则不判定 */
  failThreshold?: number;
  /** 项目名，未提供时由检测结果或「未获取」填充 */
  projectName?: string;
}

/** 报告生成产物 */
export interface ReportOutput {
  /** 报告落盘路径 */
  reportPath: string;
  /** JSON 结构化数据伴随产物路径（若生成），否则 undefined */
  jsonPath?: string;
  /** 结果摘要（用于回显给用户） */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    /** 整体结论：通过 / 不通过 */
    conclusion: 'pass' | 'fail';
    /** 最关键的 1~3 条失败原因（失败时） */
    topFailures: string[];
  };
  /** 生成过程中发生的诊断/降级提示 */
  diagnostics: string[];
}

/** 解析器插件接口 —— 新增框架支持只需实现该接口并注册 */
export interface TestResultParser {
  /** 框架标识，如 `jest` / `vitest` / `junit` */
  name: string;
  /** 该解析器能否处理给定文件（按内容/扩展名判断） */
  canParse(filePath: string, content: string): boolean;
  /** 解析为统一 TestResult */
  parse(filePath: string, content: string): TestResult;
}

/** 测试执行结果（执行模式） */
export interface ExecutionResult {
  /** 是否执行成功（命令可运行，区别于用例失败） */
  success: boolean;
  /** 标准输出与错误输出合并后的文本（用于诊断） */
  output: string;
  /** 生成的结果文件路径（若 reporter 落盘） */
  resultFile?: string;
  /** 执行耗时（毫秒） */
  durationMs: number;
  /** 失败诊断信息（success=false 时必填） */
  diagnostic?: string;
  /** 退出码 */
  exitCode: number | null;
}
