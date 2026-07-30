package com.antgroup.algorithm;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;

/**
 * {@link QuickSort} 的单元测试类，覆盖空数组、null、单元素、已序、逆序、
 * 重复元素及随机乱序等核心场景，遵循 FIRST 原则。
 *
 * @author dtcoder
 * @date 2026/07/30
 */
class QuickSortTest {

    /**
     * 被测对象
     */
    private final QuickSort quickSort = new QuickSort();

    @Test
    @DisplayName("sort：null 数组不抛异常")
    void sortNullArrayShouldDoNothing() {
        int[] array = null;
        quickSort.sort(array);
    }

    @Test
    @DisplayName("sort：空数组保持不变")
    void sortEmptyArrayShouldRemainEmpty() {
        int[] array = new int[0];
        quickSort.sort(array);
        assertEquals(0, array.length);
    }

    @Test
    @DisplayName("sort：单元素数组保持不变")
    void sortSingleElementShouldRemainUnchanged() {
        int[] array = {42};
        quickSort.sort(array);
        assertArrayEquals(new int[] {42}, array);
    }

    @Test
    @DisplayName("sort：已升序数组保持不变")
    void sortAlreadySortedArrayShouldRemainSorted() {
        int[] array = {1, 2, 3, 4, 5};
        quickSort.sort(array);
        assertArrayEquals(new int[] {1, 2, 3, 4, 5}, array);
    }

    @Test
    @DisplayName("sort：逆序数组转为升序")
    void sortReversedArrayShouldBecomeAscending() {
        int[] array = {5, 4, 3, 2, 1};
        quickSort.sort(array);
        assertArrayEquals(new int[] {1, 2, 3, 4, 5}, array);
    }

    @Test
    @DisplayName("sort：含重复元素的数组正确排序并稳定保留")
    void arrayWithDuplicatesShouldBeSorted() {
        int[] array = {3, 1, 2, 3, 1, 2};
        quickSort.sort(array);
        assertArrayEquals(new int[] {1, 1, 2, 2, 3, 3}, array);
    }

    @Test
    @DisplayName("sort：全相同元素保持不变")
    void sortAllSameElementsShouldRemainUnchanged() {
        int[] array = {7, 7, 7, 7, 7};
        quickSort.sort(array);
        assertArrayEquals(new int[] {7, 7, 7, 7, 7}, array);
    }

    @Test
    @DisplayName("sort：随机乱序数组正确升序")
    void sortRandomArrayShouldBeAscending() {
        int[] array = {9, 3, 7, 1, 8, 2, 6, 5, 4, 0};
        quickSort.sort(array);
        assertArrayEquals(new int[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9}, array);
    }

    @Test
    @DisplayName("sort：含负元素数组正确排序")
    void sortNegativeNumbersShouldBeSorted() {
        int[] array = {-3, 5, -1, 0, -8, 2};
        quickSort.sort(array);
        assertArrayEquals(new int[] {-8, -3, -1, 0, 2, 5}, array);
    }

    @Test
    @DisplayName("sortedCopy：原数组不被修改")
    void sortedCopyShouldNotMutateOriginalArray() {
        int[] original = {5, 4, 3, 2, 1};
        int[] copy = quickSort.sortedCopy(original);
        assertArrayEquals(new int[] {1, 2, 3, 4, 5}, copy);
        // 原数组保持不变
        assertArrayEquals(new int[] {5, 4, 3, 2, 1}, original);
    }

    @Test
    @DisplayName("sortedCopy：null 入参返回空数组")
    void sortedCopyNullShouldReturnEmptyArray() {
        int[] result = quickSort.sortedCopy(null);
        assertNotNull(result);
        assertEquals(0, result.length);
    }

    @Test
    @DisplayName("sortedCopy：返回新实例而非原数组引用")
    void sortedCopyShouldReturnNewArrayInstance() {
        int[] array = {3, 1, 2};
        int[] result = quickSort.sortedCopy(array);
        // 返回结果不应是原数组同一引用
        boolean sameReference = array == result;
        assertEquals(false, sameReference);
    }
}
