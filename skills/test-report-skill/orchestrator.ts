/**
 * 编排器（T1.8）+ 落盘与返回摘要（T1.11）
 *
 * 执行模式：触发测试运行（run_in_background）→ 收集结果文件路径
 * 解析模式：检测 result_file 参数 → 跳过执行，直接解析
 * 命令无法运行时返回诊断信息，不得生成空报告（FR1.4 / AC4）
 *
 * 编排流程（Error Handling Flow）:
 *   模式判定 → (执行/解析) → ParserRegistry.detectAndParse → SecurityFilter → Generator → 落盘
 */
import * as fs from 'fs';
import * as path from 'path';
import type { TestResultModel, TestReportConfig } from './types';
import { TOOL_VERSION } from './types';
import { createDefaultRegistry } from './parsers/registry';
import { FrameworkDetector } from './detectors/framework-detector';
import { applySecurityFilter } from './security-filter';
import { MarkdownGenerator } from './generators/markdown-generator';
import { HtmlGenerator } from './generators/html-generator';
import { JsonGenerator } from './generators/json-generator';

export interface OrchestrationResult {
  success: boolean;
  reportPath?: string;
  summary?: {
    passRate: number;
    failed: number;
    total: number;
  };
  topFailures?: Array<{ testName: string; errorMessage: string }>;
  error?: string;
}

export class Orchestrator {
  private detector = new FrameworkDetector();
  private registry = createDefaultRegistry();
  private markdownGen = new MarkdownGenerator();
  private htmlGen = new HtmlGenerator();
  private jsonGen = new JsonGenerator();

  /**
   * 主入口
   * @param config 用户配置
   * @param projectRoot 项目根目录
   * @param rawTestOutput 测试执行的原始输出（执行模式时由调用方传入）
   */
  async run(
    config: TestReportConfig,
    projectRoot: string,
    rawTestOutput?: string
  ): Promise<OrchestrationResult> {
    try {
      // 模式判定（FR1.3）
      const isParseMode =
        config.resultFile && config.resultFile !== 'auto';

      let resultFile: string;
      let executedCommand: string;

      if (isParseMode) {
        // 解析模式：跳过执行，直接解析
        resultFile = config.resultFile!;
        executedCommand = `parse-only: ${resultFile}`;
      } else {
        // 执行模式
        const detection = this.detector.detect(
          projectRoot,
          config.testCommand
        );
        executedCommand = detection.command;
        resultFile = detection.resultFileHint;

        // 执行模式需要 rawTestOutput（由调用方通过 background_exec 运行测试后传入）
        if (!rawTestOutput) {
          // 未提供测试输出，尝试读取结果文件
          if (!fs.existsSync(resultFile)) {
            return {
              success: false,
              error:
                `[orchestrator] 执行模式需要测试结果文件，但未找到: ${resultFile}\n` +
                `建议：先运行测试命令 \`${executedCommand}\`，或使用解析模式指定已有结果文件路径。`,
            };
          }
        } else {
          // 将测试输出写入结果文件供解析
          fs.writeFileSync(resultFile, rawTestOutput, 'utf-8');
        }
      }

      // 读取结果文件
      if (!fs.existsSync(resultFile)) {
        return {
          success: false,
          error: `[orchestrator] 结果文件不存在: ${resultFile}`,
        };
      }

      const raw = fs.readFileSync(resultFile, 'utf-8');

      // 校验非空（AC4）
      if (!raw.trim()) {
        return {
          success: false,
          error: `[orchestrator] 结果文件为空: ${resultFile}，无法生成报告。`,
        };
      }

      // 解析（AC4：损坏文件返回明确错误）
      let model: TestResultModel;
      try {
        model = this.registry.detectAndParse(resultFile, raw);
      } catch (e) {
        return {
          success: false,
          error: (e as Error).message,
        };
      }

      // 覆盖率处理（T2.2 / T2.4）
      if (config.coverage !== 'off') {
        model = this.enrichCoverage(model, projectRoot, config.coverage);
      }

      // 填充实际执行命令
      model.header.executedCommand = executedCommand;

      // 安全过滤（D3：报告生成前强制运行）
      model = applySecurityFilter(model);

      // 生成报告（支持 markdown/html/json 多格式，FR3.1）
      const format = config.outputFormat ?? 'markdown';
      const reportContent = this.generateReport(model, format, config.failThreshold);

      // 落盘（FR3.2）
      const reportPath = this.resolveReportPath(
        config.outputPath ?? 'reports/',
        projectRoot,
        format
      );
      const dir = path.dirname(reportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(reportPath, reportContent, 'utf-8');

      // JSON 伴随产物（T3.2：output_format=json 时输出结构化数据）
      if (format === 'markdown' || format === 'html') {
        const jsonPath = reportPath.replace(/\.(md|html)$/, '.json');
        const jsonContent = this.jsonGen.generate(model);
        fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
      }

      // 返回摘要（FR3.3）
      const topFailures = model.failures.slice(0, 3).map((f) => ({
        testName: f.testName,
        errorMessage: f.errorMessage,
      }));

      return {
        success: true,
        reportPath,
        summary: {
          passRate: model.summary.passRate,
          failed: model.summary.failed,
          total: model.summary.total,
        },
        topFailures: model.summary.failed > 0 ? topFailures : undefined,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  /** 覆盖率增强（T2.2） */
  private enrichCoverage(
    model: TestResultModel,
    projectRoot: string,
    mode?: string
  ): TestResultModel {
    // 尝试解析 coverage-final.json
    const coveragePaths = [
      path.join(projectRoot, 'coverage', 'coverage-final.json'),
      path.join(projectRoot, 'coverage-final.json'),
    ];

    for (const cp of coveragePaths) {
      if (fs.existsSync(cp)) {
        try {
          const covData = JSON.parse(fs.readFileSync(cp, 'utf-8'));
          model.coverage = this.parseCoverage(covData);
          return model;
        } catch {
          // 覆盖率解析失败，标注未获取
        }
      }
    }

    // coverage=on 时强制尝试，auto 时无则标注未获取
    if (mode === 'on') {
      model.coverage = model.coverage ?? undefined;
    }

    return model;
  }

  /** 解析 Istanbul/coverage-final.json → 覆盖率汇总 */
  private parseCoverage(covData: Record<string, unknown>): TestResultModel['coverage'] {
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;
    const belowThresholdFiles: string[] = [];

    for (const [filePath, data] of Object.entries(covData)) {
      const d = data as {
        s?: Record<string, number>;
        b?: Record<string, number[]>;
        f?: Record<string, number>;
        statementMap?: Record<string, { start: { line: number } }>;
      };

      // statements
      if (d.s) {
        for (const v of Object.values(d.s)) {
          totalStatements++;
          if (v > 0) coveredStatements++;
        }
      }
      // branches
      if (d.b) {
        for (const v of Object.values(d.b)) {
          for (const bv of v) {
            totalBranches++;
            if (bv > 0) coveredBranches++;
          }
        }
      }
      // functions
      if (d.f) {
        for (const v of Object.values(d.f)) {
          totalFunctions++;
          if (v > 0) coveredFunctions++;
        }
      }
      // lines（近似：以 statement 覆盖行计）
      if (d.s && d.statementMap) {
        const coveredLinesSet = new Set<number>();
        for (const [key, count] of Object.entries(d.s)) {
          if (count > 0) {
            const sm = d.statementMap[key];
            if (sm?.start?.line) coveredLinesSet.add(sm.start.line);
          }
        }
        const allLinesSet = new Set<number>();
        for (const [key] of Object.entries(d.statementMap)) {
          const sm = d.statementMap[key];
          if (sm?.start?.line) allLinesSet.add(sm.start.line);
        }
        totalLines += allLinesSet.size;
        coveredLines += coveredLinesSet.size;
      }

      // 低于阈值的文件（默认 80%）
      const fileStmtRate =
        totalStatements > 0
          ? (coveredStatements / totalStatements) * 100
          : 100;
      if (fileStmtRate < 80) {
        belowThresholdFiles.push(path.relative(process.cwd(), filePath));
      }
    }

    const pct = (covered: number, total: number) =>
      total > 0 ? Math.round((covered / total) * 1000) / 10 : 0;

    return {
      statements: pct(coveredStatements, totalStatements),
      branches: pct(coveredBranches, totalBranches),
      functions: pct(coveredFunctions, totalFunctions),
      lines: pct(coveredLines, totalLines),
      belowThresholdFiles:
        belowThresholdFiles.length > 0 ? belowThresholdFiles : undefined,
    };
  }

  /** 生成报告（支持 markdown/html/json 多格式，FR3.1） */
  private generateReport(
    model: TestResultModel,
    format: 'markdown' | 'html' | 'json',
    failThreshold?: number
  ): string {
    switch (format) {
      case 'html':
        return this.htmlGen.generate(model, { failThreshold });
      case 'json':
        return this.jsonGen.generate(model);
      case 'markdown':
      default:
        return this.markdownGen.generate(model, { failThreshold });
    }
  }

  /** 解析报告输出路径（FR3.2） */
  private resolveReportPath(
    outputPath: string,
    projectRoot: string,
    format: 'markdown' | 'html' | 'json' = 'markdown'
  ): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const ext = format === 'html' ? 'html' : format === 'json' ? 'json' : 'md';

    // outputPath 是目录
    if (
      outputPath.endsWith('/') ||
      outputPath.endsWith(path.sep) ||
      !path.extname(outputPath)
    ) {
      return path.join(projectRoot, outputPath, `test-report-${ts}.${ext}`);
    }
    // outputPath 是完整文件路径
    return path.join(projectRoot, outputPath);
  }
}

/** 便捷函数：解析模式入口 */
export async function generateFromResultFile(
  resultFile: string,
  projectRoot: string,
  config?: Partial<TestReportConfig>
): Promise<OrchestrationResult> {
  const orchestrator = new Orchestrator();
  return orchestrator.run(
    { resultFile, outputFormat: 'markdown', ...config },
    projectRoot
  );
}
