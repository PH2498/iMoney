package com.antgroup.algorithm;

import java.util.Arrays;

/**
 * 快速排序算法实现，提供对整型数组的原地排序能力。
 *
 * <p>采用三数取中策略选取基准元素，降低在近乎有序数据上的退化风险；
 * 分区采用 Hoare 双向扫描，减少元素交换次数。</p>
 *
 * @author dtcoder
 * @date 2026/07/30
 */
public class QuickSort {

    /**
     * 对整型数组进行升序排序（原地修改）。
     *
     * <p>该方法会直接修改入参数组，不返回新数组。当入参为 {@code null} 或长度为 0 时，
     * 视为无需排序，直接返回，避免产生 {@link NullPointerException} 或越界异常。</p>
     *
     * @param array 待排序整型数组，允许为 null 或空数组
     */
    public void sort(int[] array) {
        // 空指针或空数组无需排序，直接返回
        if (array == null || array.length == 0) {
            return;
        }
        quickSort(array, 0, array.length - 1);
    }

    /**
     * 返回排序后的新数组，不修改原数组。
     *
     * @param array 待排序整型数组，允许为 null
     * @return 升序排列的新数组；入参为 null 时返回空数组
     */
    public int[] sortedCopy(int[] array) {
        if (array == null || array.length == 0) {
            return array == null ? new int[0] : new int[0];
        }
        int[] copy = Arrays.copyOf(array, array.length);
        quickSort(copy, 0, copy.length - 1);
        return copy;
    }

    /**
     * 递归执行快速排序的内部方法。
     *
     * @param array 待排序数组
     * @param low   当前区间左边界（含）
     * @param high  当前区间右边界（含）
     */
    private void quickSort(int[] array, int low, int high) {
        // 递归终止条件：区间长度小于等于 1
        if (low >= high) {
            return;
        }
        int pivotIndex = partition(array, low, high);
        // 对基准左侧子区间递归排序
        quickSort(array, low, pivotIndex);
        // 对基准右侧子区间递归排序
        quickSort(array, pivotIndex + 1, high);
    }

    /**
     * Hoare 分区方法，选取基准并对区间进行划分。
     *
     * <p>使用三数取中策略确定基准值，避免在近乎有序的输入上退化为 O(n²)。</p>
     *
     * @param array 待分区数组
     * @param low   区间左边界（含）
     * @param high  区间右边界（含）
     * @return 基准元素最终所在位置，左侧均小于等于基准，右侧均大于等于基准
     */
    private int partition(int[] array, int low, int high) {
        int pivot = medianOfThree(array, low, high);
        int left = low - 1;
        int right = high + 1;
        while (true) {
            // 从左向右扫描，找到第一个大于等于基准的元素
            do {
                left++;
            } while (array[left] < pivot);
            // 从右向左扫描，找到第一个小于等于基准的元素
            do {
                right--;
            } while (array[right] > pivot);
            // 指针相遇，分区完成
            if (left >= right) {
                return right;
            }
            swap(array, left, right);
        }
    }

    /**
     * 三数取中：取 array[low]、array[mid]、array[high] 的中位数作为基准值。
     *
     * @param array 数组
     * @param low   左边界
     * @param high  右边界
     * @return 三数的中位数
     */
    private int medianOfThree(int[] array, int low, int high) {
        int mid = low + (high - low) / 2;
        // 令 array[low] <= array[mid]
        if (array[low] > array[mid]) {
            swap(array, low, mid);
        }
        // 令 array[low] <= array[high]
        if (array[low] > array[high]) {
            swap(array, low, high);
        }
        // 令 array[mid] <= array[high]，此时 array[mid] 为中位数
        if (array[mid] > array[high]) {
            swap(array, mid, high);
        }
        return array[mid];
    }

    /**
     * 交换数组中两个位置的元素。
     *
     * @param array 目标数组
     * @param i     位置一
     * @param j     位置二
     */
    private void swap(int[] array, int i, int j) {
        if (i == j) {
            return;
        }
        int temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}
