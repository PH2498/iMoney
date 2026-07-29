# test-report-generator

测试报告生成器 —— 测试执行后自动解析测试结果并生成结构化、可读性强的标准测试报告。

## 快速使用

### 解析模式（解析已有结果文件）

```
node --loader ts-node/esm scripts/index.ts --resultFile test-results.json --output reports/
```

或解析 JUnit XML：

```
node --loader ts-node/esm scripts/index.ts --resultFile test-results.xml --output reports/
```

### 执行模式（自动跑测试并生成报告）

```
node --loader ts-node/esm scripts/index.ts --execute --cwd . --output reports/
```

执行模式会自动识别 jest / vitest / pytest 框架并运行测试，再生成报告。

### 作为库调用

```typescript
import { generateReport } from './scripts';

const output = await generateReport({
  resultFile: 'test-results.xml',
  outputFormat: 'markdown',
  outputPath: 'reports/',
  coverage: 'auto',
});
console.log(`报告路径：${output.reportPath}`);
console.log(`通过率：${output.summary.passRate}%，失败：${output.summary.failed}`);
```

## 配置项

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--resultFile` / `-r` | 解析模式下的结果文件路径 | 自动检测 |
| `--command` / `-c` | 执行模式下的测试命令 | 自动检测 |
| `--execute` / `-e` | 强制执行模式 | false |
| `--format` / `-f` | 输出格式：markdown / html / json | markdown |
| `--output` / `-o` | 报告输出目录 | reports/ |
| `--coverage` | 覆盖率处理：auto / on / off | auto |
| `--failThreshold` | 通过率阈值百分比 | 无 |
| `--cwd` | 工作目录 | 当前目录 |
| `--projectName` | 项目名 | 自动检测 |

## 报告结构

生成的 Markdown 报告包含 6 个固定顺序章节：

1. **报告头**：项目名、生成时间、执行命令、框架/版本、执行环境
2. **结果摘要**：用例总数、通过/失败/跳过数、通过率、总耗时、整体结论 ✅/❌
3. **失败用例分析**（有失败时）：用例名、所属文件、错误信息、堆栈关键行
4. **用例明细**：按测试文件分组，超过 200 条截断
5. **覆盖率**：语句/分支/函数/行覆盖率总表 + 低覆盖文件清单
6. **附录**：原始结果文件路径、工具版本、降级提示

## 支持框架（P0）

- Jest（JSON reporter）
- Vitest（JSON reporter）
- JUnit XML（跨语言兜底）

## 设计说明

- **插件式解析器**：新增框架支持只需实现 `TestResultParser` 接口并在 `parser-registry.ts` 注册，不影响既有解析器（NFR5 / 开闭原则）。
- **依赖倒置**：报告生成器只依赖统一数据模型 `TestResult`，与具体框架解析解耦。
- **敏感信息过滤**：错误信息与堆栈在解析层即做 redact 与截断，避免泄露环境变量与密钥（NFR3）。
- **健壮性降级**：字段缺失标注「未获取」，不崩溃（NFR2）；结果文件损坏返回明确错误而非空报告（AC4）。
- **幂等性**：除生成时间外，同一结果文件多次生成的报告内容一致（NFR4）。

## 运行依赖

- Node.js >= 16
- 解析模式无外部依赖（纯 TS/JS）；执行模式需项目已安装对应测试框架（jest/vitest/pytest）

> 运行 TS 需 `ts-node` 或先编译。Agent 也可直接读取源码逻辑并在其运行时复用解析器。
