package com.dtcoder.algo;

import java.util.Arrays;
import java.util.Comparator;
import java.util.Objects;

/**
 * 快速排序工具类，提供对整型数组及任意对象数组的升序排序能力。
 *
 * <p>实现要点：
 * <ul>
 *   <li>原地分区，额外空间复杂度 O(log n)（递归栈）。</li>
 *   <li>采用「三数取中」策略选取基准值，缓解近乎有序输入下的退化为 O(n²)。</li>
 *   <li>子区间长度低于阈值 {@link #INSERTION_SORT_THRESHOLD} 时切换为插入排序，减少递归开销。</li>
 * </ul>
 *
 * @author DTCoder
 * @date 2026/07/29
 */
public final class QuickSorter {

    /** 切换为插入排序的子区间长度阈值，经验值。 */
    private static final int INSERTION_SORT_THRESHOLD = 7;

    /** 工具类禁止实例化。 */
    private QuickSorter() {
        throw new AssertionError("Utility class should not be instantiated");
    }

    /**
     * 对整型数组进行升序快速排序（原地排序）。
     *
     * @param array 待排序数组，允许为 null 或空数组
     */
    public static void sort(int[] array) {
        if (array == null || array.length < 2) {
            return;
        }
        quickSort(array, 0, array.length - 1);
    }

    /**
     * 对任意对象数组进行升序快速排序（原地排序）。
     *
     * @param <T>        数组元素类型
     * @param array      待排序数组，允许为 null 或空数组
     * @param comparator 元素比较器，不可为 null
     * @throws IllegalArgumentException 当 comparator 为 null 时
     */
    public static <T> void sort(T[] array, Comparator<? super T> comparator) {
        if (comparator == null) {
            throw new IllegalArgumentException("comparator must not be null");
        }
        if (array == null || array.length < 2) {
            return;
        }
        quickSort(array, comparator, 0, array.length - 1);
    }

    /**
     * 递归执行快速排序的主流程，对区间 [low, high] 进行排序。
     *
     * @param array 目标数组
     * @param low   起始下标（含）
     * @param high  结束下标（含）
     */
    private static void quickSort(int[] array, int low, int high) {
        while (low < high) {
            if (high - low < INSERTION_SORT_THRESHOLD) {
                insertionSort(array, low, high);
                return;
            }
            int pivotIndex = partition(array, low, high);
            // 尾递归优化：对较短一侧继续递归，较长一侧改为循环，递归深度收敛至 O(log n)
            if (pivotIndex - low < high - pivotIndex) {
                quickSort(array, low, pivotIndex - 1);
                low = pivotIndex + 1;
            } else {
                quickSort(array, pivotIndex + 1, high);
                high = pivotIndex - 1;
            }
        }
    }

    /**
     * 分区操作：选取基准值并将元素划分为小于基准与大于等于基准两部分。
     *
     * @param array 目标数组
     * @param low   起始下标（含）
     * @param high  结束下标（含）
     * @return 基准值最终所在下标
     */
    private static int partition(int[] array, int low, int high) {
        medianOfThree(array, low, high);
        int pivot = array[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (array[j] <= pivot) {
                i++;
                swap(array, i, j);
            }
        }
        swap(array, i + 1, high);
        return i + 1;
    }

    /**
     * 三数取中：对首、中、尾三元素排序后，将中值交换到 high 位置作为基准。
     *
     * @param array 目标数组
     * @param low   起始下标（含）
     * @param high  结束下标（含）
     */
    private static void medianOfThree(int[] array, int low, int high) {
        int mid = low + (high - low) / 2;
        if (array[low] > array[mid]) {
            swap(array, low, mid);
        }
        if (array[low] > array[high]) {
            swap(array, low, high);
        }
        if (array[mid] > array[high]) {
            swap(array, mid, high);
        }
        // 排序后 array[low] <= array[mid] <= array[high]，将中值交换到 high 作为基准，避免退化
        swap(array, mid, high);
    }

    /**
     * 对小区间执行插入排序。
     *
     * @param array 目标数组
     * @param low   起始下标（含）
     * @param high  结束下标（含）
     */
    private static void insertionSort(int[] array, int low, int high) {
        for (int i = low + 1; i <= high; i++) {
            int current = array[i];
            int k = i - 1;
            while (k >= low && array[k] > current) {
                array[k + 1] = array[k];
                k--;
            }
            array[k + 1] = current;
        }
    }

    /**
     * 交换数组中两个位置的元素。
     *
     * @param array 目标数组
     * @param i     下标 i
     * @param j     下标 j
     */
    private static void swap(int[] array, int i, int j) {
        if (i != j) {
            int temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    /**
     * 对象数组版快速排序主流程。
     *
     * @param array      目标数组
     * @param comparator 元素比较器
     * @param low        起始下标（含）
     * @param high       结束下标（含）
     */
    private static <T> void quickSort(T[] array, Comparator<? super T> comparator, int low, int high) {
        while (low < high) {
            if (high - low < INSERTION_SORT_THRESHOLD) {
                insertionSort(array, comparator, low, high);
                return;
            }
            int pivotIndex = partition(array, comparator, low, high);
            if (pivotIndex - low < high - pivotIndex) {
                quickSort(array, comparator, low, pivotIndex - 1);
                low = pivotIndex + 1;
            } else {
                quickSort(array, comparator, pivotIndex + 1, high);
                high = pivotIndex - 1;
            }
        }
    }

    /**
     * 对象数组版分区操作。
     *
     * @param array      目标数组
     * @param comparator 元素比较器
     * @param low        起始下标（含）
     * @param high       结束下标（含）
     * @return 基准值最终所在下标
     */
    private static <T> int partition(T[] array, Comparator<? super T> comparator, int low, int high) {
        medianOfThree(array, comparator, low, high);
        T pivot = array[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (comparator.compare(array[j], pivot) <= 0) {
                i++;
                swap(array, i, j);
            }
        }
        swap(array, i + 1, high);
        return i + 1;
    }

    /**
     * 对象数组版三数取中。
     *
     * @param array      目标数组
     * @param comparator 元素比较器
     * @param low        起始下标（含）
     * @param high       结束下标（含）
     */
    private static <T> void medianOfThree(T[] array, Comparator<? super T> comparator, int low, int high) {
        int mid = low + (high - low) / 2;
        if (comparator.compare(array[low], array[mid]) > 0) {
            swap(array, low, mid);
        }
        if (comparator.compare(array[low], array[high]) > 0) {
            swap(array, low, high);
        }
        if (comparator.compare(array[mid], array[high]) > 0) {
            swap(array, mid, high);
        }
        // 排序后 array[low] <= array[mid] <= array[high]，将中值交换到 high 作为基准，避免退化
        swap(array, mid, high);
    }

    /**
     * 对象数组版插入排序。
     *
     * @param array      目标数组
     * @param comparator 元素比较器
     * @param low        起始下标（含）
     * @param high       结束下标（含）
     */
    private static <T> void insertionSort(T[] array, Comparator<? super T> comparator, int low, int high) {
        for (int i = low + 1; i <= high; i++) {
            T current = array[i];
            int k = i - 1;
            while (k >= low && comparator.compare(array[k], current) > 0) {
                array[k + 1] = array[k];
                k--;
            }
            array[k + 1] = current;
        }
    }

    /**
     * 对象数组版交换。
     *
     * @param array 目标数组
     * @param i     下标 i
     * @param j     下标 j
     */
    private static <T> void swap(T[] array, int i, int j) {
        if (i != j) {
            T temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }
}
