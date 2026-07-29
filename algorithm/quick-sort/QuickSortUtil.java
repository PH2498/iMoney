package com.antdigital.algorithm;

import java.util.ArrayList;
import java.util.List;

/**
 * 快速排序工具类，提供对整型数组与泛型列表的升序排序能力
 *
 * <p>采用 Lomuto 分区策略，原地交换，平均时间复杂度 O(n log n)，
 * 最坏情况（已有序且取末元素为基准）退化为 O(n^2)。</p>
 *
 * <p>本类为工具类，仅提供静态方法，禁止实例化。</p>
 *
 * @author DTCoder
 * @date 2026/07/29
 */
public final class QuickSortUtil {

    /**
     * 默认构造方法，私有化以禁止实例化
     */
    private QuickSortUtil() {
        // 工具类禁止实例化
    }

    /**
     * 对整型数组进行升序快速排序，返回排序后的新数组
     *
     * <p>原数组不会被修改，方法内部拷贝后排序。</p>
     *
     * @param array 待排序的整型数组
     * @return 升序排列的新数组；入参为空数组时返回空数组
     * @throws IllegalArgumentException 当 array 为 null 时抛出
     */
    public static int[] sort(int[] array) {
        if (array == null) {
            throw new IllegalArgumentException("input array must not be null");
        }
        int[] copy = array.clone();
        quickSortInt(copy, 0, copy.length - 1);
        return copy;
    }

    /**
     * 对泛型列表进行升序快速排序，返回排序后的新列表
     *
     * <p>原列表不会被修改，方法内部拷贝后排序。</p>
     *
     * @param list   待排序的列表
     * @param <T>    列表元素类型，必须实现 Comparable
     * @return 升序排列的新列表；入参为空列表时返回空列表
     * @throws IllegalArgumentException 当 list 为 null 时抛出
     */
    public static <T extends Comparable<T>> List<T> sort(List<T> list) {
        if (list == null) {
            throw new IllegalArgumentException("input list must not be null");
        }
        List<T> copy = new ArrayList<>(list);
        quickSortComparable(copy, 0, copy.size() - 1);
        return copy;
    }

    /**
     * 对整型数组子区间进行递归快速排序
     *
     * @param array 待排序数组
     * @param low   区间下界索引（含）
     * @param high  区间上界索引（含）
     */
    private static void quickSortInt(int[] array, int low, int high) {
        if (low >= high) {
            return;
        }
        int pivotIndex = partitionInt(array, low, high);
        quickSortInt(array, low, pivotIndex - 1);
        quickSortInt(array, pivotIndex + 1, high);
    }

    /**
     * 对整型数组子区间进行 Lomuto 分区
     *
     * <p>取末元素为基准，将小于基准的元素交换至左侧，
     * 返回基准最终落位的索引。</p>
     *
     * @param array 待分区数组
     * @param low   区间下界索引（含）
     * @param high  区间上界索引（含）
     * @return 基准元素最终索引
     */
    private static int partitionInt(int[] array, int low, int high) {
        int pivot = array[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (array[j] <= pivot) {
                i++;
                swapInt(array, i, j);
            }
        }
        swapInt(array, i + 1, high);
        return i + 1;
    }

    /**
     * 交换整型数组中两个位置的元素
     *
     * @param array 目标数组
     * @param i     位置一
     * @param j     位置二
     */
    private static void swapInt(int[] array, int i, int j) {
        if (i == j) {
            return;
        }
        int temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }

    /**
     * 对泛型列表子区间进行递归快速排序
     *
     * @param list 待排序列表
     * @param low  区间下界索引（含）
     * @param high 区间上界索引（含）
     * @param <T>  元素类型
     */
    private static <T extends Comparable<T>> void quickSortComparable(List<T> list, int low, int high) {
        if (low >= high) {
            return;
        }
        int pivotIndex = partitionComparable(list, low, high);
        quickSortComparable(list, low, pivotIndex - 1);
        quickSortComparable(list, pivotIndex + 1, high);
    }

    /**
     * 对泛型列表子区间进行 Lomuto 分区
     *
     * @param list 待分序列表
     * @param low  区间下界索引（含）
     * @param high 区间上界索引（含）
     * @param <T>  元素类型
     * @return 基准元素最终索引
     */
    private static <T extends Comparable<T>> int partitionComparable(List<T> list, int low, int high) {
        T pivot = list.get(high);
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (list.get(j).compareTo(pivot) <= 0) {
                i++;
                swapList(list, i, j);
            }
        }
        swapList(list, i + 1, high);
        return i + 1;
    }

    /**
     * 交换列表中两个位置的元素
     *
     * @param list 目标列表
     * @param i    位置一
     * @param j    位置二
     * @param <T>  元素类型
     */
    private static <T> void swapList(List<T> list, int i, int j) {
        if (i == j) {
            return;
        }
        T temp = list.get(i);
        list.set(i, list.get(j));
        list.set(j, temp);
    }
}
