/**
 * 快速排序算法实现
 * 支持数字数组和自定义比较函数
 */

type CompareFunction<T> = (a: T, b: T) => number;

/**
 * 默认比较函数（升序）
 */
const defaultCompare = <T>(a: T, b: T): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * 快速排序主函数
 * @param arr 待排序数组
 * @param compare 比较函数，默认升序
 * @returns 排序后的新数组（不修改原数组）
 */
export function quickSort<T>(arr: T[], compare: CompareFunction<T> = defaultCompare): T[] {
  // 边界条件：空数组或单元素数组直接返回
  if (arr.length <= 1) {
    return [...arr];
  }

  const result = [...arr];
  quickSortInPlace(result, 0, result.length - 1, compare);
  return result;
}

/**
 * 原地快速排序（内部实现）
 */
function quickSortInPlace<T>(
  arr: T[],
  low: number,
  high: number,
  compare: CompareFunction<T>
): void {
  if (low < high) {
    const pivotIndex = partition(arr, low, high, compare);
    quickSortInPlace(arr, low, pivotIndex - 1, compare);
    quickSortInPlace(arr, pivotIndex + 1, high, compare);
  }
}

/**
 * 分区函数
 * @returns 分区点索引
 */
function partition<T>(
  arr: T[],
  low: number,
  high: number,
  compare: CompareFunction<T>
): number {
  // 选择中间元素作为基准，避免最坏情况
  const mid = Math.floor((low + high) / 2);
  const pivot = arr[mid];
  
  // 将基准交换到末尾
  [arr[mid], arr[high]] = [arr[high], arr[mid]];
  
  let i = low - 1;
  
  for (let j = low; j < high; j++) {
    if (compare(arr[j], pivot) <= 0) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  
  // 将基准放回正确位置
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}

/**
 * 原地快速排序（修改原数组）
 * @param arr 待排序数组
 * @param compare 比较函数
 * @returns 排序后的数组（与原数组引用相同）
 */
export function quickSortInPlaceWrapper<T>(
  arr: T[],
  compare: CompareFunction<T> = defaultCompare
): T[] {
  quickSortInPlace(arr, 0, arr.length - 1, compare);
  return arr;
}

/**
 * 降序快速排序
 */
export function quickSortDesc<T>(arr: T[], compare?: CompareFunction<T>): T[] {
  const descCompare: CompareFunction<T> = compare 
    ? (a, b) => -compare(a, b)
    : (a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      };
  return quickSort(arr, descCompare);
}

export default quickSort;