/**
 * 解析器注册中心 —— 插件式结构核心。
 *
 * 新增框架支持步骤（开闭原则）：
 * 1. 在对应解析器文件实现 TestResultParser 接口；
 * 2. 在 `createDefaultParsers()` 注册（仅此一处需改动，既有解析器不受影响）；
 * 3. 其余编排、报告生成代码无需修改。
 *
 * 注册中心仅负责"找到合适的解析器"，不关心解析细节（单一职责）。
 */
import type { TestResultParser, TestResult } from './types.ts';
// 静态 import 解析器实现（集中注册点，新增框架仅在此追加）
import { JestJsonParser } from './parsers/jest-json-parser.ts';
import { VitestJsonParser } from './parsers/vitest-json-parser.ts';
import { JUnitXmlParser } from './parsers/junit-xml-parser.ts';

/** 解析器注册表 */
export class ParserRegistry {
  private readonly parsers: TestResultParser[] = [];

  /** 注册一个解析器 */
  register(parser: TestResultParser): this {
    this.parsers.push(parser);
    return this;
  }

  /** 查找能处理给定文件的第一个解析器 */
  find(filePath: string, content: string): TestResultParser | undefined {
    return this.parsers.find((p) => {
      try {
        return p.canParse(filePath, content);
      } catch {
        return false;
      }
    });
  }

  /** 列出已注册解析器名（用于诊断） */
  names(): string[] {
    return this.parsers.map((p) => p.name);
  }

  /**
   * 解析结果文件。找不到合适解析器或解析失败时抛错并附诊断，
   * 由上层决定降级或报错（不在注册中心静默吞错）。
   */
  parse(filePath: string, content: string): TestResult {
    const parser = this.find(filePath, content);
    if (!parser) {
      throw new Error(
        `无法识别测试结果文件格式，无匹配解析器。已注册解析器：${this.names().join(', ') || '(无)'}。` +
          `文件：${filePath}`,
      );
    }
    return parser.parse(filePath, content);
  }
}

/**
 * 创建默认解析器注册表（P0：Jest/Vitest JSON + JUnit XML）。
 * 新增框架支持时仅在此处追加解析器实例。
 */
export function createDefaultParsers(): ParserRegistry {
  return new ParserRegistry()
    .register(new JestJsonParser())
    .register(new VitestJsonParser())
    .register(new JUnitXmlParser());
}
