/**
 * JSON 伴随产物生成器（T3.2）
 *
 * 输出结构化的 TestResultModel JSON（可选伴随产物）
 * 下游程序可解析消费（T3-V2）
 */
import type { TestResultModel } from '../types';

export class JsonGenerator {
  /**
   * 生成 JSON 字符串
   * @param pretty 是否美化输出（默认 true）
   */
  generate(model: TestResultModel, pretty = true): string {
    if (pretty) {
      return JSON.stringify(model, null, 2);
    }
    return JSON.stringify(model);
  }
}
