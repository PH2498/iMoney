# Code Review Checklist

> **Change** `quicksort-impl` · **分支/Commit** `AI/task-DEV-966dcd0a` / `248f1dd` · **日期** `2026-07-30`

> **AI**：唯一进度源；状态仅用 `⬜` `✅` `❌` `⚠️` `N/A`。
> **完成标准**：所有核销项必须从 `⬜` 变为其他状态；`N/A` 需写原因。

> **执行顺序（强制）**：已先运行 `scan-all-rules.sh`，输出贴入 Step 3/Step 4 备注；再用 LLM 完成 Step 2–5 复核。

> **scan-all-rules.sh 预扫结果**：`No findings. 52/222 rules scanned`（无程序化规则命中）

---

## Step 1 — 执行队列（产物 A）

| # | 文件（仓库相对路径） | 归属原因 | Step2 | Step3 | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 | G10 | G11 | G12 | G13 | G14 | G15 | G16 | G17 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | 总状态 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/main/java/com/antgroup/algorithm/QuickSort.java` | REQ-1 快速排序 | ✅ | ⚠️ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ⚠️ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ⚠️ |
| 2 | `src/test/java/com/antgroup/algorithm/QuickSortTest.java` | REQ-1 测试 | ✅ | ⚠️ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ⚠️ |

> **G/S 列说明**：本项目为纯算法库（无并发/DB/MQ/缓存/RPC/定时/灰度/SQL/认证等），G1–G17、S1–S10 大部分与变更无关，标 `N/A(无 SQL/无 MQ/…)`。G16（异常/日志）对 QuickSort.java 命中 `⚠️`（递归栈溢出风险，P2），其余 N/A。

---

## Step 2 — 功能（产物 B）

| REQ | Scenario | Spec证据（原文/章节） | 关联文件 | 状态 | 代码证据（文件/测试/接口） |
|-----|----------|----------------------|----------|------|----------------------------|
| REQ-1 | Given 整型数组，When 调用 sort()，Then 原地升序排列 | `<requirement_section>: 实现一个快速排序算法` | `QuickSort.java:24-30` | ✅ | `sort()` 调用 `quickSort(array, 0, array.length - 1)`；Hoare 分区 + 三数取中，递归方案 `[low,p]` / `[p+1,high]` 正确且可终止 |
| REQ-1 | Given null/空数组，When 调用 sort()，Then 不抛异常 | `<requirement_section>` | `QuickSort.java:26-28` | ✅ | `if (array == null \|\| array.length == 0) return;` + 测试 `sortNullArrayShouldDoNothing` / `sortEmptyArrayShouldRemainEmpty` |
| REQ-1 | Given 整型数组，When 调用 sortedCopy()，Then 返回新数组且原数组不变 | `<requirement_section>` | `QuickSort.java:38-45` | ✅ | `Arrays.copyOf` + `quickSort(copy, ...)`；测试 `sortedCopyShouldNotMutateOriginalArray` 验证原数组不变 |
| REQ-1 | Given null，When 调用 sortedCopy()，Then 返回空数组 | `<requirement_section>` | `QuickSort.java:39-41` | ✅ | `return new int[0]`；测试 `sortedCopyNullShouldReturnEmptyArray` |

> **递归终止性推演**：`medianOfThree` 排序后保证 `array[low] ≤ pivot(=array[mid]) ≤ array[high]`。partition 首次迭代中，左指针因 `array[mid] = pivot` 至多停在 `mid`（`mid < high`），故若右指针停在 `high`（`array[high]==pivot`），则 `left < right` 必走交换而非返回；后续迭代右指针至少递减一次，返回值 `p` 满足 `low ≤ p < high`，两子区间均严格缩小 → **递归必然终止**。

---

## Step 3 — 可读性检查（产物 C）

| ID | 检查项 | 状态 | 备注（命中写 `path:line`） |
|----|--------|------|----------------------------|
| A1 | 源文件格式 | ✅ | UTF-8、4 空格缩进、LF 换行，均合规 |
| A2 | 源文件结构/import 顺序 | ⚠️ | `QuickSortTest.java:9` — `import static ...Assertions.assertSame` 未被使用（冗余 import） |
| A3 | 代码样式 | ✅ | 大括号、行宽、空行风格一致 |
| A4 | 命名规范 | ✅ | 类名/方法名/变量名符合驼峰规范 |
| A5 | 编码实践 | ⚠️ | `QuickSort.java:40` — `array == null ? new int[0] : new int[0]` 三元两分支完全相同，冗余 |
| A6 | 特定元素样式 | ✅ | 常量/字面量使用正常 |
| A7 | Javadoc 规范 | ⚠️ | `QuickSort.java:74` — partition `@return 基准元素最终所在位置` 不精确：Hoare 分区返回的是分区边界 `right`，并非基准元素最终所在位置 |

---

## Step 4 — 可靠性检查（产物 D）

### 4.1 Bug 模式（`bug-pattern-checklist.md`）

> **预扫**：`scan-all-rules.sh` → `No findings. 52/222 rules scanned`
> **LLM 复核**：逐类核对，以下列出与纯数组排序算法相关的 ID，其余标 N/A。

| ID | 状态 | 备注 |
|----|------|------|
| B002 | ✅ | 测试使用 `assertArrayEquals` 比较数组内容，未误用 `equals()` |
| B004 | ✅ | 未使用 `array.toString()`，无命中 |
| B005 | ✅ | 未使用 `Arrays.asList` 对基本类型数组，无命中 |
| B006 | ✅ | `assertEquals(expected, actual)` 参数顺序正确（`QuickSortTest.java:37,111,121`） |
| B011 | ✅ | 全程使用 `int` 基本类型比较（`<`/`>`/`==`），无包装类型 `==` 比较 |
| B030 | ✅ | 无浮点数 `==` 比较 |
| B038 | ✅ | 无无限递归：`quickSort` 有 `low >= high` 终止条件 + 分区保证子区间缩小 |
| B001/B003/B007–B010/B012–B037/B039–B081 | N/A | 不涉及日期解析/Calendar/BigDecimal/线程池/集合泛型/Money/异常捕获/移位/Unsafe 等（纯 int 数组排序） |
| M001–M027 | N/A | 不涉及 Major 级别的 IO/资源/序列化/反射/泛型擦除等场景 |
| I001–I010 | N/A | 不涉及 Info 级别的风格建议命中 |

### 4.2 可靠性（`reliability-checklist.md`）

| ID | 状态 | 备注 |
|----|------|------|
| G1.1–G1.4 | N/A | 无并发/多线程 |
| G2.1–G2.3 | N/A | 无资源释放（无 close/连接/流） |
| G3.1–G3.2 | N/A | 无事务边界 |
| G4.1–G4.4 | N/A | 无并发与幂等 |
| G5.1 | N/A | 无限流 |
| G6.1–G6.2 | N/A | 无缓存 |
| G7.1–G7.2 | N/A | 无异步 |
| G8.1–G8.7 | N/A | 无 IO/RPC/序列化/外部调用 |
| G9.1–G9.3 | N/A | 无定时任务 |
| G10.1–G10.3 | N/A | 无配置/开关 |
| G11.1–G11.4 | N/A | 无发布/灰度 |
| G12.1–G12.2 | N/A | 无容量/降级 |
| G13.1 | N/A | 无容灾 |
| G14.1–G14.4 | N/A | 无日志框架（纯算法库） |
| G15.1–G15.3 | N/A | 无监控 |
| G16.1 | ✅ | 无异常吞没（算法本身不 catch） |
| G16.2 | ⚠️ | `QuickSort.java:54-64` — 递归实现，极端对抗输入下有理论 `StackOverflowError` 风险；medianOfThree 已将退化概率降至极低（期望 O(log n) 深度），P2 改进建议：对大数组可改用迭代+显式栈或切换插入排序 |
| G16.3–G16.4 | N/A | 无日志/NPE 兜底（已显式 null 检查） |
| G17.1–G17.3 | N/A | 无应急 |
| G18.1–G18.3 | N/A | 无安全补强场景 |

### 4.3 安全（`security-checklist.md`）

| ID | 状态 | 备注 |
|----|------|------|
| S1.1–S1.3 | N/A | 无 SQL |
| S2.1–S2.3 | N/A | 无反序列化 |
| S3.1–S3.3 | N/A | 无 XXE |
| S4.1–S4.2 | N/A | 无 SSRF |
| S5.1–S5.2 | N/A | 无密钥/凭证 |
| S6.1 | N/A | 无 XSS |
| S7 | N/A | 无文件上传 |
| S8 | N/A | 无命令执行 |
| S9 | N/A | 无权限 |
| S10 | N/A | 无 CSRF/CORS |

---

## Step 5 — 自定义扩展检查（产物 E）

| 域 | 参考 | 结果 | 等级 | 说明 |
|----|------|------|------|------|
| 自定义扩展 | `customized-checklist.md` U* | N/A | — | N/A(未启用自定义规则)：`customized-checklist.md` 为空/示例项 |

---

## 收口核验

- ✅ 执行队列 `⬜ 待审` 为零（2 文件均已审完）
- ✅ Step 2 章节级勾选与逐文件结论一致
- ✅ Step 3/4/5 跨文件条目已合并勾选
- ✅ report 审查范围文件数 = 2，与已审队列一致
- ✅ `scan-all-rules.sh` 已执行（`No findings. 52/222 rules scanned`）
