package com.dtcoder.algo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Comparator;
import java.util.Random;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * {@link QuickSorter} 单元测试。
 *
 * <p>遵循 FIRST 原则，独立可重复，覆盖正常与边界场景。
 *
 * @author DTCoder
 * @date 2026/07/29
 */
class QuickSorterTest {

    /**
     * 整型数组排序测试组。
     */
    @Nested
    @DisplayName("int[] 排序")
    class IntArraySortTest {

        @Test
        @DisplayName("null 数组不抛异常且无副作用")
        void shouldHandleNullArray() {
            int[] array = null;
            assertDoesNotThrow(() -> QuickSorter.sort(array));
        }

        @Test
        @DisplayName("空数组保持为空")
        void shouldHandleEmptyArray() {
            int[] array = {};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{}, array);
        }

        @Test
        @DisplayName("单元素数组保持不变")
        void shouldHandleSingleElementArray() {
            int[] array = {42};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{42}, array);
        }

        @Test
        @DisplayName("已升序数组保持不变")
        void shouldHandleAlreadySortedArray() {
            int[] array = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, array);
        }

        @Test
        @DisplayName("逆序数组被排序为升序")
        void shouldHandleReverseSortedArray() {
            int[] array = {10, 9, 8, 7, 6, 5, 4, 3, 2, 1};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, array);
        }

        @Test
        @DisplayName("含重复元素数组被稳定排序为非降序")
        void shouldHandleArrayWithDuplicates() {
            int[] array = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9}, array);
        }

        @Test
        @DisplayName("全相同元素数组保持不变")
        void shouldHandleAllEqualElements() {
            int[] array = {7, 7, 7, 7, 7, 7, 7};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{7, 7, 7, 7, 7, 7, 7}, array);
        }

        @Test
        @DisplayName("包含负数的数组被正确排序")
        void shouldHandleNegativeNumbers() {
            int[] array = {0, -5, 3, -1, 8, -3, 2};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{-5, -3, -1, 0, 2, 3, 8}, array);
        }

        @Test
        @DisplayName("随机大数组排序后与 JDK Arrays.sort 结果一致")
        void shouldSortLargeRandomArrayConsistentWithJdk() {
            Random random = new Random(20260729L);
            int[] expected = IntStream.generate(() -> random.nextInt(10000)).limit(2000).toArray();
            int[] actual = expected.clone();
            QuickSorter.sort(actual);
            Arrays.sort(expected);
            assertArrayEquals(expected, actual);
        }

        @Test
        @DisplayName("触发插入排序阈值的短数组排序正确")
        void shouldSortShortArrayBelowInsertionThreshold() {
            int[] array = {5, 2, 8, 1, 9, 3, 7};
            QuickSorter.sort(array);
            assertArrayEquals(new int[]{1, 2, 3, 5, 7, 8, 9}, array);
        }
    }

    /**
     * 对象数组排序测试组。
     */
    @Nested
    @DisplayName("T[] 排序")
    class ObjectArraySortTest {

        @Test
        @DisplayName("comparator 为 null 时抛出 IllegalArgumentException")
        void shouldThrowWhenComparatorIsNull() {
            assertThrows(IllegalArgumentException.class, () -> QuickSorter.sort(new Integer[]{1}, null));
        }

        @Test
        @DisplayName("null 对象数组不抛异常")
        void shouldHandleNullObjectArray() {
            Integer[] array = null;
            assertDoesNotThrow(() -> QuickSorter.sort(array, Comparator.<Integer>naturalOrder()));
        }

        @Test
        @DisplayName("对象数组按比较器升序排列")
        void shouldSortObjectArray() {
            Integer[] array = {5, 3, 8, 1, 9, 2, 6, 4, 7, 0};
            QuickSorter.sort(array, Comparator.naturalOrder());
            assertArrayEquals(new Integer[]{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}, array);
        }

        @Test
        @DisplayName("对象数组按降序比较器排列")
        void shouldSortObjectArrayDescending() {
            Integer[] array = {5, 3, 8, 1, 9, 2, 6, 4, 7, 0};
            QuickSorter.sort(array, Comparator.reverseOrder());
            assertArrayEquals(new Integer[]{9, 8, 7, 6, 5, 4, 3, 2, 1, 0}, array);
        }

        @Test
        @DisplayName("字符串数组按字典序排列")
        void shouldSortStringArray() {
            String[] array = {"banana", "apple", "cherry", "date"};
            QuickSorter.sort(array, Comparator.naturalOrder());
            assertArrayEquals(new String[]{"apple", "banana", "cherry", "date"}, array);
        }
    }
}
