# Code Review Report

> **Change** `quicksort-impl` · **分支/Commit** `AI/task-DEV-966dcd0a` / `248f1dd` · **日期** `2026-07-30` · **审查者** AI

> **AI**：等级 **P0 / P1 / P2**；G/S 以 checklist 行内定义为准；Bug 模式以 `bug-pattern-checklist.md` 表头为准（Blocker→P0、Major→P1、Info→P2）。已先运行 `scan-all-rules.sh` 并将要点并入 §5，再写 LLM 结论。

---

## 1. 审查范围

| 项 | 值 |
|----|-----|
| `.java` 文件数 | `2` |
| 变更行数 | `+300 / -0` |

| 类/接口 | 路径 | 角色（可选） |
|---------|------|--------------|
| `QuickSort` | `src/main/java/com/antgroup/algorithm/QuickSort.java` | 快速排序算法实现 |
| `QuickSortTest` | `src/test/java/com/antgroup/algorithm/QuickSortTest.java` | 单元测试 |

> `pom.xml` 为构建配置，非 `.java`，不纳入 Java 逐文件审查（已在 checklist 标跳过）。

---

## 2. 问题计数

| P0 | P1 | P2 |
|----|----|-----|
| 0 | 0 | 4 |

---

## 3. Step 2 — 功能（REQ）

### REQ-1: 快速排序算法

| Scenario | 结果 | Spec证据 | 代码证据 | 说明 |
|----------|------|----------|----------|------|
| Given 整型数组 When 调用 sort() Then 原地升序 | ✅ | `<requirement_section>: 实现一个快速排序算法` | `QuickSort.java:24-30` | Hoare 分区 + 三数取中 + 递归 `[low,p]`/`[p+1,high]`，正确且可终止 |
| Given null/空数组 When sort() Then 不抛异常 | ✅ | `<requirement_section>` | `QuickSort.java:26-28` + 测试 `sortNullArrayShouldDoNothing`/`sortEmptyArrayShouldRemainEmpty` | 显式 null/length==0 守卫 |
| Given 整型数组 When sortedCopy() Then 返回新数组原数组不变 | ✅ | `<requirement_section>` | `QuickSort.java:38-45` + 测试 `sortedCopyShouldNotMutateOriginalArray` | `Arrays.copyOf` 拷贝后排序，原数组未被触碰 |
| Given null When sortedCopy() Then 返回空数组 | ✅ | `<requirement_section>` | `QuickSort.java:39-41` + 测试 `sortedCopyNullShouldReturnEmptyArray` | `new int[0]` |

> **递归终止性推演**：`medianOfThree`（`QuickSort.java:105-120`）排序后保证 `array[low] ≤ array[mid](=pivot) ≤ array[high]`。partition 首次迭代左指针因 `array[mid]==pivot` 至多停在 `mid < high`，故返回值 `p` 必满足 `low ≤ p < high`，两子区间严格缩小 → 递归必然终止，无无限递归风险。

---

## 4. Step 3 — 可读性检查

| 结果 | 说明（违规写 Ax.x 与 `path:行`） |
|------|--------------------------------|
| ⚠️ | 命中 3 处 P2：`A2` `QuickSortTest.java:9`（未使用 import）、`A5` `QuickSort.java:40`（冗余三元）、`A7` `QuickSort.java:74`（partition @return 不精确） |

---

## 5. Step 4 — 可靠性检查

| 域 | 参考 | 结果 | 等级 | 说明（列命中 ID 或「已扫无命中」） |
|----|------|------|------|-------------------------------------|
| 可靠性 | `reliability-checklist.md` G1–G17 | ⚠️ | P2 | G16.2：递归实现理论栈溢出风险（`QuickSort.java:54-64`）；medianOfThree 已将退化概率降至极低；其余 G* 均 N/A（纯算法库无并发/DB/MQ/RPC/缓存/事务/日志等） |
| 安全 | `security-checklist.md` S1–S10 | N/A | — | 无 SQL/反序列化/XXE/SSRF/密钥/XSS/上传/命令/权限/CSRF 场景 |
| Bug 模式 | `bug-pattern-checklist.md` B/M/I（120） | ✅ | — | 预扫：`scan-all-rules.sh` → `No findings. 52/222 rules scanned`；LLM 复核相关 ID（B002/B004/B005/B006/B011/B030/B038）均无命中，其余 N/A（不涉及） |

---

## 6. Step 5 — 自定义扩展检查

| 域 | 参考 | 结果 | 等级 | 说明（列命中 ID 或「未启用自定义规则」） |
|----|------|------|------|------------------------------------------|
| 自定义扩展 | `customized-checklist.md` U* | N/A | — | 未启用自定义规则：清单为空/示例项 |

---

## 7. 结论

- **合并建议**：通过
- **P0**：无
- **P1**：无
- **P2**：
  1. `QuickSortTest.java:9` — 未使用的 import `assertSame`（A2）
  2. `QuickSort.java:40` — 冗余三元 `array == null ? new int[0] : new int[0]`，两分支相同（A5）
  3. `QuickSort.java:74` — partition `@return` 注释「基准元素最终所在位置」不精确，Hoare 分区返回的是分区边界 `right` 而非基准元素位置（A7）
  4. `QuickSort.java:54-64` — 递归实现，极端对抗输入下理论 `StackOverflowError` 风险；medianOfThree 已大幅缓解（G16.2）
- **一句话**：快速排序算法实现正确、功能与测试完备，无阻塞性问题；4 项 P2 均为可读性/健壮性可选改进，不影响合并。

---

## 7.1 问题片段（必填）

### P2-1 · `A2` · `src/test/java/com/antgroup/algorithm/QuickSortTest.java:9` — 未使用的 import

片段范围：`src/test/java/com/antgroup/algorithm/QuickSortTest.java:6-10`

```java
L6|import static org.junit.jupiter.api.Assertions.assertArrayEquals;
L7|import static org.junit.jupiter.api.Assertions.assertEquals;
L8|import static org.junit.jupiter.api.Assertions.assertNotNull;
L9|import static org.junit.jupiter.api.Assertions.assertSame;  // 问题：全文件未调用 assertSame()
L10|
```

### P2-2 · `A5` · `src/main/java/com/antgroup/algorithm/QuickSort.java:40` — 冗余三元表达式

片段范围：`src/main/java/com/antgroup/algorithm/QuickSort.java:38-45`

```java
L38|    public int[] sortedCopy(int[] array) {
L39|        if (array == null || array.length == 0) {
L40|            return array == null ? new int[0] : new int[0];  // 问题：两分支结果完全相同
L41|        }
L42|        int[] copy = Arrays.copyOf(array, array.length);
L43|        quickSort(copy, 0, copy.length - 1);
L44|        return copy;
L45|    }
```

### P2-3 · `A7` · `src/main/java/com/antgroup/algorithm/QuickSort.java:74` — partition @return 注释不精确

片段范围：`src/main/java/com/antgroup/algorithm/QuickSort.java:66-76`

```java
L66|    /**
L67|     * Hoare 分区方法，选取基准并对区间进行划分。
L68|     *
L69|     * <p>使用三数取中策略确定基准值，避免在近乎有序的输入上退化为 O(n²)。</p>
L70|     *
L71|     * @param array 待分区数组
L72|     * @param low   区间左边界（含）
L73|     * @param high  区间右边界（含）
L74|     * @return 基准元素最终所在位置，左侧均小于等于基准，右侧均大于等于基准  // 问题：Hoare 分区返回的是分区边界 right，非基准元素最终位置
L75|     */
L76|    private int partition(int[] array, int low, int high) {
```

### P2-4 · `G16.2` · `src/main/java/com/antgroup/algorithm/QuickSort.java:54-64` — 递归栈溢出理论风险

片段范围：`src/main/java/com/antgroup/algorithm/QuickSort.java:54-64`

```java
L54|    private void quickSort(int[] array, int low, int high) {
L55|        // 递归终止条件：区间长度小于等于 1
L56|        if (low >= high) {
L57|            return;
L58|        }
L59|        int pivotIndex = partition(array, low, high);
L60|        // 对基准左侧子区间递归排序
L61|        quickSort(array, low, pivotIndex);        // 问题：递归调用，极端对抗输入理论 StackOverflowError
L62|        // 对基准右侧子区间递归排序
L63|        quickSort(array, pivotIndex + 1, high);
L64|    }
```

---

## 8. 修复任务列表

> 供后续改代码时逐项执行与核销；与 §3–§7 中 ⚠️ 及结论中的可执行项对应。

- [ ] `QuickSortTest.java:9` — 删除未使用的 `import static ...Assertions.assertSame`
- [ ] `QuickSort.java:40` — 将 `return array == null ? new int[0] : new int[0]` 简化为 `return new int[0]`
- [ ] `QuickSort.java:74` — 修正 partition `@return` 描述为「分区边界索引 right，左侧元素均 ≤ 基准，右侧元素均 ≥ 基准」
- [ ] `QuickSort.java:54-64` — （可选）对超大数组改用迭代+显式栈或将小区间切换插入排序，消除理论栈溢出风险
