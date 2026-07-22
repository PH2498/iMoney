/**
 * 解析器插件接口与注册表（NFR5 插件式结构）
 *
 * 设计决策 D2：静态注册，新增框架不影响既有解析器。
 * 探测顺序按注册顺序，首个 canHandle() 返回 true 的解析器胜出。
 */
import type { TestResultModel } from '../types';

/**
 * 解析器插件接口
 * 每个框架由独立解析器实现，共享统一中间数据模型 TestResultModel。
 */
export interface TestResultParser {
  /** "jest" | "vitest" | "junit" | "pytest" */
  name: string;
  /** 格式探测：根据文件路径和内容判断是否可处理 */
  canHandle(filePath: string, content?: string): boolean;
  /** 解析为统一模型 */
  parse(raw: string): TestResultModel;
}

/**
 * 解析器注册表
 * 静态注册（非运行时热插拔），满足 NFR5 且避免动态加载安全风险。
 */
export class ParserRegistry {
  private parsers: TestResultParser[] = [];

  /** 注册解析器 */
  register(parser: TestResultParser): void {
    this.parsers.push(parser);
  }

  /** 批量注册 */
  registerAll(parsers: TestResultParser[]): void {
    for (const p of parsers) this.register(p);
  }

  /** 按注册顺序探测，返回首个可处理的解析器 */
  detect(filePath: string, content?: string): TestResultParser | null {
    for (const parser of this.parsers) {
      if (parser.canHandle(filePath, content)) {
        return parser;
      }
    }
    return null;
  }

  /** 探测并解析，返回统一模型；无匹配解析器时抛明确错误（AC4） */
  detectAndParse(filePath: string, raw: string): TestResultModel {
    const parser = this.detect(filePath, raw);
    if (!parser) {
      throw new Error(
        `[test-report-skill] 无法识别结果文件格式: ${filePath}。` +
          `已注册解析器: ${this.parsers.map((p) => p.name).join(', ') || '无'}。` +
          `支持格式: Jest JSON, Vitest JSON, JUnit XML, pytest(JUnit XML/JSON)。`
      );
    }
    return parser.parse(raw);
  }

  /** 列出已注册解析器名 */
  listNames(): string[] {
    return this.parsers.map((p) => p.name);
  }
}

/** 默认注册表单例（P0: jest/vitest/junit，P1: pytest） */
export function createDefaultRegistry(): ParserRegistry {
  // 延迟导入避免循环依赖
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JestParser } = require('./jest-parser');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { VitestParser } = require('./vitest-parser');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JUnitParser } = require('./junit-parser');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PytestParser } = require('./pytest-parser');

  const registry = new ParserRegistry();
  registry.registerAll([
    new JestParser(),
    new VitestParser(),
    new JUnitParser(),
    new PytestParser(),
  ]);
  return registry;
}
