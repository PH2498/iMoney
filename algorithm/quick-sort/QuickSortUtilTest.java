package com.antdigital.algorithm;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatObject;

/**
 * 快速排序工具类单元测试
 *
 * <p>遵循 AAA 模式与 FIRST 原则，覆盖正常路径、边界场景、异常路径。</p>
 *
 * @author DTCoder
 * @date 2026/07/29
 */
@DisplayName("QuickSortUtil 快速排序工具类单测")
class QuickSortUtilTest {

    @Nested
    @DisplayName("sort(int[]) 整型数组排序")
    class SortIntArray {

        @Test
        @DisplayName("正常路径：乱序数组升序排序")
        void should_returnSortedArray_when_unsortedInput() {
            // Arrange
            int[] input = {5, 3, 8, 1, 9, 2, 7, 4, 6};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9);
        }

        @Test
        @DisplayName("正常路径：含重复元素数组稳定排序")
        void should_keepDuplicates_when_duplicateElements() {
            // Arrange
            int[] input = {3, 1, 2, 3, 1, 2};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(1, 1, 2, 2, 3, 3);
        }

        @Test
        @DisplayName("正常路径：含负数与零的数组")
        void should_sortCorrectly_when_negativeAndZero() {
            // Arrange
            int[] input = {0, -5, 3, -1, 2, -8};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(-8, -5, -1, 0, 2, 3);
        }

        @Test
        @DisplayName("边界：空数组返回空数组")
        void should_returnEmptyArray_when_emptyInput() {
            // Arrange
            int[] input = {};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("边界：单元素数组原样返回")
        void should_returnSameArray_when_singleElement() {
            // Arrange
            int[] input = {42};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(42);
        }

        @Test
        @DisplayName("边界：已升序数组保持有序")
        void should_keepOrder_when_alreadySorted() {
            // Arrange
            int[] input = {1, 2, 3, 4, 5};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(1, 2, 3, 4, 5);
        }

        @Test
        @DisplayName("边界：已降序数组反转为升序")
        void should_reverseToAsc_when_descendingOrder() {
            // Arrange
            int[] input = {9, 8, 7, 6, 5, 4, 3, 2, 1};

            // Act
            int[] result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9);
        }

        @Test
        @DisplayName("异常路径：入参为 null 抛 IllegalArgumentException")
        void should_throwException_when_nullInput() {
            // Arrange
            int[] input = null;

            // Act & Assert
            assertThatThrownBy(() -> QuickSortUtil.sort(input))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("array");
        }
    }

    @Nested
    @DisplayName("sort(List) 泛型列表排序")
    class SortGenericList {

        @Test
        @DisplayName("正常路径：String 列表按字典序排序")
        void should_returnSortedList_when_stringList() {
            // Arrange
            List<String> input = Arrays.asList("banana", "apple", "cherry");

            // Act
            List<String> result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly("apple", "banana", "cherry");
        }

        @Test
        @DisplayName("正常路径：Integer 列表排序")
        void should_returnSortedList_when_integerList() {
            // Arrange
            List<Integer> input = Arrays.asList(5, 2, 8, 1, 9);

            // Act
            List<Integer> result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).containsExactly(1, 2, 5, 8, 9);
        }

        @Test
        @DisplayName("边界：空列表返回空列表")
        void should_returnEmptyList_when_emptyList() {
            // Arrange
            List<Integer> input = Collections.emptyList();

            // Act
            List<Integer> result = QuickSortUtil.sort(input);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("异常路径：列表入参为 null 抛 IllegalArgumentException")
        void should_throwException_when_nullList() {
            // Arrange
            List<Integer> input = null;

            // Act & Assert
            assertThatThrownBy(() -> QuickSortUtil.sort(input))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("list");
        }
    }

    @Test
    @DisplayName("正确性验证：大数组排序结果与 Arrays.sort 一致")
    void should_matchJdkSort_when_largeRandomArray() {
        // Arrange
        int size = 1000;
        int[] input = new int[size];
        for (int i = 0; i < size; i++) {
            input[i] = (int) (Math.random() * 10000);
        }
        int[] expected = input.clone();
        Arrays.sort(expected);

        // Act
        int[] result = QuickSortUtil.sort(input);

        // Assert
        assertThat(result).isEqualTo(expected);
    }

    @Test
    @DisplayName("不修改原数组：sort(int[]) 返回新数组")
    void should_notMutateOriginalArray_when_sortIntArray() {
        // Arrange
        int[] input = {5, 3, 1, 4, 2};
        int[] inputCopy = input.clone();

        // Act
        QuickSortUtil.sort(input);

        // Assert
        assertThat(input).isEqualTo(inputCopy);
    }

    @Test
    @DisplayName("格式验证：String 排序结果非 null")
    void should_notReturnNull_when_stringSort() {
        // Arrange
        List<String> input = Arrays.asList("b", "a");

        // Act
        List<String> result = QuickSortUtil.sort(input);

        // Assert
        assertThatObject(result).isNotNull();
    }
}
