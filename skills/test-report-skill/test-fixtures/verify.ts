/**
 * 验证脚本：覆盖 AC1~AC5 + NFR4 + T3-V1/V2
 *
 * 运行方式：npx tsx skills/test-report-skill/test-fixtures/verify.ts
 *
 * 验证项：
 *  T1-V2 失败用例分析（AC2）：Jest fixture 含失败用例
 *  T1-V3 解析模式（AC3）：JUnit XML 走解析模式不触发执行
 *  T1-V4 损坏文件（AC4）：corrupted.json 返回明确错误
 *  T1-V5 幂等性（NFR4）：同一结果多次生成非时间戳内容一致
 *  T2-V2 覆盖率（AC5）：无覆盖率标注「未获取」
 *  T3-V1 HTML 输出结构与 Markdown 一致
 *  T3-V2 JSON 产物可被解析
 */
import * as fs from 'fs';
import * as path from 'path';
import { createDefaultRegistry } from '../parsers/registry';
import { applySecurityFilter } from '../security-filter';
import { MarkdownGenerator } from '../generators/markdown-generator';
import { HtmlGenerator } from '../generators/html-generator';
import { JsonGenerator } from '../generators/json-generator';

const FIXTURES = path.join(__dirname);
let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    pass++;
  } else {
    console.error(`  ❌ ${msg}`);
    fail++;
  }
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

// ──────────────────────────────────────────
// AC2/T1-V2: Jest fixture 失败用例分析
// ──────────────────────────────────────────
console.log('\n[AC2/T1-V2] Jest fixture 失败用例分析:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-jest.json');
  const model = registry.detectAndParse('jest-results.json', raw);

  assert(model.summary.total === 4, 'total === 4');
  assert(model.summary.passed === 2, 'passed === 2');
  assert(model.summary.failed === 1, 'failed === 1');
  assert(model.summary.skipped === 1, 'skipped === 1 (pending+todo)');
  assert(model.failures.length === 1, 'failures.length === 1');
  assert(
    model.failures[0].testName.includes('should fail'),
    'failure testName 包含 "should fail"'
  );
  assert(
    model.failures[0].filePath.includes('math.test.ts'),
    'failure filePath 包含 math.test.ts'
  );
  assert(
    model.failures[0].errorMessage.includes('expected 2'),
    'failure errorMessage 包含错误信息'
  );
  assert(
    model.failures[0].stackTrace.length <= 21,
    'stackTrace 截断至 20 行（+1 截断提示）'
  );
}

// ──────────────────────────────────────────
// AC3/T1-V3: JUnit XML 解析模式
// ──────────────────────────────────────────
console.log('\n[AC3/T1-V3] JUnit XML 解析模式:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-junit.xml');
  const model = registry.detectAndParse('test-results.xml', raw);

  assert(model.summary.total === 4, 'total === 4');
  assert(model.summary.failed === 1, 'failed === 1');
  assert(model.summary.skipped === 1, 'skipped === 1');
  assert(
    model.summary.passed === 2,
    'passed === 2 (total - failed - skipped)'
  );
  assert(
    model.summary.passRate === 50,
    'passRate === 50.0%'
  );
  assert(model.failures.length === 1, 'failures.length === 1');
  assert(
    model.failures[0].errorMessage.includes('AssertionError'),
    'failure errorMessage 包含 AssertionError'
  );
  assert(
    model.details.length > 0,
    'details 不为空'
  );
}

// ──────────────────────────────────────────
// AC4/T1-V4: 损坏文件返回明确错误
// ──────────────────────────────────────────
console.log('\n[AC4/T1-V4] 损坏文件返回明确错误:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('corrupted.json');

  let threw = false;
  let errMsg = '';
  try {
    registry.detectAndParse('corrupted.json', raw);
  } catch (e) {
    threw = true;
    errMsg = (e as Error).message;
  }
  assert(threw, '损坏文件抛出错误而非静默');
  assert(
    errMsg.includes('不是合法 JSON') || errMsg.includes('无法识别'),
    '错误信息明确说明原因'
  );
}

// ──────────────────────────────────────────
// NFR4/T1-V5: 幂等性
// ──────────────────────────────────────────
console.log('\n[NFR4/T1-V5] 幂等性:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-jest.json');
  const mdGen = new MarkdownGenerator();

  // 解析两次（generatedAt 不同，其余须一致）
  const model1 = applySecurityFilter(
    registry.detectAndParse('jest.json', raw)
  );
  // 稍作延迟确保时间戳可能不同
  const model2 = applySecurityFilter(
    registry.detectAndParse('jest.json', raw)
  );

  const report1 = mdGen.generate(model1);
  const report2 = mdGen.generate(model2);

  // 去掉时间戳行后比较
  const stripTs = (s: string) =>
    s.replace(/> 生成时间:.*$/m, '');

  assert(
    stripTs(report1) === stripTs(report2),
    '非时间戳部分内容一致'
  );
}

// ──────────────────────────────────────────
// AC5/T2-V2: 覆盖率标注「未获取」
// ──────────────────────────────────────────
console.log('\n[AC5/T2-V2] 覆盖率标注「未获取」:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-jest.json');
  const model = registry.detectAndParse('jest.json', raw);

  assert(
    model.coverage === undefined,
    '无覆盖率数据时 coverage === undefined'
  );

  const mdGen = new MarkdownGenerator();
  const report = mdGen.generate(applySecurityFilter(model));
  assert(
    report.includes('## 覆盖率'),
    '报告含覆盖率章节'
  );
  assert(
    report.includes('未获取'),
    '覆盖率章节标注「未获取」'
  );
  assert(
    report.includes('## 结果摘要'),
    '其余章节正常输出'
  );
}

// ──────────────────────────────────────────
// NFR3: 安全过滤器
// ──────────────────────────────────────────
console.log('\n[NFR3] 安全过滤器:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-jest.json');
  const model = registry.detectAndParse('jest.json', raw);
  // 注入敏感信息
  model.failures[0].errorMessage =
    'Error: token=abc123secret at /Users/johndoe/project';
  model.header.executedCommand = 'npm test --token=secretkey123';

  const filtered = applySecurityFilter(model);
  assert(
    !filtered.failures[0].errorMessage.includes('abc123secret'),
    '密钥 token=xxx 被过滤'
  );
  assert(
    filtered.failures[0].errorMessage.includes('<redacted>') ||
      filtered.failures[0].errorMessage.includes('token=<redacted>'),
    '密钥被替换为 <redacted>'
  );
  assert(
    !filtered.failures[0].errorMessage.includes('/Users/johndoe'),
    '敏感路径 /Users/xxx 被过滤'
  );
  assert(
    !filtered.header.executedCommand.includes('secretkey123'),
    '执行命令中的密钥被过滤'
  );
}

// ──────────────────────────────────────────
// T3-V1: HTML 输出结构
// ──────────────────────────────────────────
console.log('\n[T3-V1] HTML 输出结构:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-jest.json');
  const model = applySecurityFilter(
    registry.detectAndParse('jest.json', raw)
  );

  const htmlGen = new HtmlGenerator();
  const html = htmlGen.generate(model);

  assert(html.includes('<!DOCTYPE html>'), '含 DOCTYPE');
  assert(html.includes('测试报告'), '含标题');
  assert(html.includes('结果摘要'), '含结果摘要章节');
  assert(html.includes('失败用例分析'), '含失败用例分析章节');
  assert(html.includes('用例明细'), '含用例明细章节');
  assert(html.includes('覆盖率'), '含覆盖率章节');
  assert(html.includes('附录'), '含附录章节');
}

// ──────────────────────────────────────────
// T3-V2: JSON 产物可解析
// ──────────────────────────────────────────
console.log('\n[T3-V2] JSON 产物可解析:');
{
  const registry = createDefaultRegistry();
  const raw = readFixture('sample-jest.json');
  const model = registry.detectAndParse('jest.json', raw);

  const jsonGen = new JsonGenerator();
  const jsonStr = jsonGen.generate(model);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
    assert(true, 'JSON 可被 JSON.parse 解析');
  } catch (e) {
    parsed = null;
    assert(false, 'JSON 可被 JSON.parse 解析');
  }

  if (parsed) {
    const p = parsed as { summary: { total: number }; failures: unknown[] };
    assert(
      p.summary.total === 4,
      'JSON 产物 summary.total === 4'
    );
    assert(
      Array.isArray(p.failures),
      'JSON 产物 failures 是数组'
    );
  }
}

// ──────────────────────────────────────────
// 总结
// ──────────────────────────────────────────
console.log('\n──────────────────');
console.log(`通过: ${pass}，失败: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
